// Framer exec script — READ-ONLY. Run in its own exec, after repoint.js applied.
// Proves each usage now carries the new asset, the old hash is gone, and the alt is the
// approved one. CMS rows are re-read at value.url / value.altText.
//
//   npx @framer/agent@latest exec -s <id> < verify-repoint.js
//
// Writes /tmp/framer-launch/verify-repoint.json. Tick the tracker only on a clean result.
// Decorative images: an empty altText may not serialise at all (default-valued attributes
// are omitted), so "" reads as missing here. Those rows are confirmed in the rendered HTML
// instead: site-scan.mjs after the next publish must show alt="" on them.

const fs = require("fs")
const DIR = "/tmp/framer-launch"
if (!(await framer.getCodeFiles()).length) throw new Error("getCodeFiles() is 0 — dead module registry. Open a new session.")
const inv = JSON.parse(fs.readFileSync(`${DIR}/inventory.json`, "utf8")).rows
const man = Object.fromEntries(JSON.parse(fs.readFileSync(`${DIR}/manifest.json`, "utf8")).map((r) => [r.hash, r]))
const up = JSON.parse(fs.readFileSync(`${DIR}/uploaded.json`, "utf8"))
const rows = inv.filter((r) => up[r.hash]?.verified && man[r.hash] && !man[r.hash].skip && !r.byHand)
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim()
const res = { ok: 0, bad: [], checkInHtml: [] }

const ids = [...new Set(rows.filter((r) => r.kind !== "cms").map((r) => r.id))]
const nodes = {}
for (let i = 0; i < ids.length; i += 25) {
  const got = await framer.agent.serializeNodes({ ids: ids.slice(i, i + 25), depth: 0 })
  for (const n of Array.isArray(got) ? got : Object.values(got)) nodes[n.id] = { ...n, ...(n.attributes ?? {}) }
}
const cols = Object.fromEntries((await framer.getCollections()).map((c) => [c.id, c]))
const items = {}

for (const r of rows) {
  const newH = up[r.hash].url.split("/").pop().split(".")[0]
  const want = man[r.hash].decorative ? "" : norm(man[r.hash].alt)
  let src, alt
  if (r.kind === "cms") {
    items[r.collectionId] ??= Object.fromEntries((await cols[r.collectionId].getItems()).map((i) => [i.id, i]))
    const v = items[r.collectionId][r.itemId]?.fieldData?.[r.fieldId]
    src = v?.value?.url ?? v?.url ?? ""; alt = v?.value?.altText ?? v?.altText
  } else {
    const n = nodes[r.id] ?? {}
    if (r.kind === "frame") { src = JSON.stringify(n.fill ?? ""); alt = n.altText }
    if (r.kind === "instance") { const v = n[r.control]; src = JSON.stringify(v?.src ?? v ?? ""); alt = v?.alt }
    if (r.kind === "metadata") { src = JSON.stringify(n.metadata?.[r.field] ?? ""); alt = want }
  }
  const problems = []
  if (!String(src).includes(newH)) problems.push("new asset missing")
  if (String(src).includes(r.hash)) problems.push("old hash still there")
  if (r.kind !== "metadata") {
    if (want === "" && (alt === undefined || alt === null)) res.checkInHtml.push(r.id ?? r.slug)
    else if (norm(alt) !== want) problems.push(`alt is ${JSON.stringify(alt)}`)
  }
  // An inheriting replica reads its primary's value; a missing node is a stale id
  if (r.kind !== "cms" && !nodes[r.id]) problems.push("node not found (stale id?)")
  if (problems.length) res.bad.push({ kind: r.kind, id: r.id ?? `${r.collection}/${r.slug}`, problems })
  else res.ok++
}
fs.writeFileSync(`${DIR}/verify-repoint.json`, JSON.stringify(res, null, 2))
console.log(`${res.ok} ok · ${res.bad.length} wrong · ${res.checkInHtml.length} decorative to confirm in HTML after publish`)
if (res.bad.length) console.log(JSON.stringify(res.bad.slice(0, 20), null, 1))
