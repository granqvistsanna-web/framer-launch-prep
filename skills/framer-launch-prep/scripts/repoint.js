// Framer exec script — points every usage of an old image at its uploaded replacement and
// writes the approved alt text. DRY RUN unless state.repointApply === true.
//
//   npx @framer/agent@latest exec -s <id> < repoint.js                      # prints commands
//   npx @framer/agent@latest exec -s <id> -e 'state.repointApply = true'
//   npx @framer/agent@latest exec -s <id> < repoint.js                      # applies them
//   npx @framer/agent@latest exec -s <id> < verify-repoint.js               # SEPARATE exec
//
// Reads /tmp/framer-launch/{inventory.json, manifest.json, uploaded.json}.
// Only hashes whose upload passed verify-uploads.mjs (verified: true) are touched.
//
// Every write is ONE command per applyChanges call, measured the hard way:
//  - a newline-joined batch applies only its first statement
//  - batched writes on compound (replica / variant) ids no-op, or land the wrong value on
//    the wrong replica
// Primaries go first. A replica is written only if it still shows the OLD hash after its
// primary changed, which means it carries its own override; the rest inherit.
// Re-runnable: a node already carrying the new asset is skipped.

const fs = require("fs")
const DIR = "/tmp/framer-launch"
if (!(await framer.getCodeFiles()).length) throw new Error("getCodeFiles() is 0 — dead module registry. Open a new session.")
const inv = JSON.parse(fs.readFileSync(`${DIR}/inventory.json`, "utf8")).rows
const man = Object.fromEntries(JSON.parse(fs.readFileSync(`${DIR}/manifest.json`, "utf8")).map((r) => [r.hash, r]))
const up = JSON.parse(fs.readFileSync(`${DIR}/uploaded.json`, "utf8"))
const APPLY = state.repointApply === true
state.repointApply = false // one apply per explicit opt-in
// DSL string literal: collapse whitespace (a CSV can carry newlines), JSON-escape the rest
const lit = (s) => JSON.stringify(String(s ?? "").replace(/\s+/g, " ").trim())
const newHash = (h) => up[h].url.split("/").pop().split(".")[0]

const todo = inv.filter((r) => up[r.hash]?.url && up[r.hash]?.verified && man[r.hash] && !man[r.hash].skip && !r.byHand)
const altOf = (r) => (man[r.hash].decorative ? "" : man[r.hash].alt)
const cmdFor = (r) => {
  const url = up[r.hash].url
  if (r.kind === "frame") return `SET ${r.id} fill=${lit(url)} altText=${lit(altOf(r))};`
  if (r.kind === "instance") return `SET ${r.id} ${r.control}.src=${lit(url)} ${r.control}.alt=${lit(altOf(r))};`
  if (r.kind === "metadata") return `SET ${r.id} metadata.${r.field}=${lit(url)};`
  return null
}
const canvas = todo.filter((r) => ["frame", "instance", "metadata"].includes(r.kind))
const primaries = canvas.filter((r) => !r.isReplica)
const replicas = canvas.filter((r) => r.isReplica)
const cms = todo.filter((r) => r.kind === "cms")

const log = { applied: [], skipped: [], failed: [] }
const read = async (id) => { const n = (await framer.agent.serializeNodes({ ids: [id], depth: 0 }))?.[0] ?? {}; return JSON.stringify({ ...n, ...(n.attributes ?? {}) }) }
async function write(r) {
  const cmd = cmdFor(r)
  if (!APPLY) { log.applied.push(cmd); return }
  try {
    if ((await read(r.id)).includes(newHash(r.hash))) { log.skipped.push(r.id); return } // already done
    await framer.agent.applyChanges(cmd, { pagePath: "/" })
    log.applied.push(cmd)
  } catch (e) { log.failed.push({ id: r.id, cmd, error: String(e.message || e).slice(0, 200) }) }
}

for (const r of primaries) await write(r)
for (const r of replicas) {
  // After the primary changed: still the old hash here = its own override → write it
  if (APPLY && !(await read(r.id)).includes(r.hash)) { log.skipped.push(r.id + " (inherits)"); continue }
  await write(r)
}

// CMS: collections and items fetched once; one failure never stops the rest
if (APPLY && cms.length) {
  const cols = Object.fromEntries((await framer.getCollections()).map((c) => [c.id, c]))
  const items = {}
  for (const r of cms) {
    try {
      items[r.collectionId] ??= Object.fromEntries((await cols[r.collectionId].getItems()).map((i) => [i.id, i]))
      await items[r.collectionId][r.itemId].setAttributes({ fieldData: { [r.fieldId]: { type: "image", value: up[r.hash].url, alt: altOf(r) } } })
      log.applied.push(`cms ${r.collection}/${r.slug} ${r.field}`)
    } catch (e) { log.failed.push({ id: `${r.collection}/${r.slug}`, error: String(e.message || e).slice(0, 200) }) }
  }
} else for (const r of cms) log.applied.push(`cms ${r.collection}/${r.slug} ${r.field} → setAttributes`)

fs.writeFileSync(`${DIR}/repoint-log.json`, JSON.stringify(log, null, 2))
console.log(`${APPLY ? "APPLIED" : "DRY RUN"} · ${log.applied.length} writes · ${log.skipped.length} skipped · ${log.failed.length} failed · primaries ${primaries.length} · replicas ${replicas.length} · cms ${cms.length} · by hand ${inv.filter((r) => r.byHand).length}`)
if (!APPLY) console.log(log.applied.slice(0, 30).join("\n"))
if (log.failed.length) console.log("failed:", JSON.stringify(log.failed.slice(0, 10)))
if (APPLY) console.log("Now run verify-repoint.js in a SEPARATE exec. Nothing here is proof.")
