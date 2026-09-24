// Framer exec script — READ-ONLY. Every place an image lives in the project, keyed by the
// framerusercontent hash so it joins against site-scan.mjs's published inventory.
//
//   npx @framer/agent@latest exec -s <id> < canvas-inventory.js
//
// Writes /tmp/framer-launch/inventory.json (exec fs is sandboxed to cwd, /tmp, os.tmpdir)
// and leaves the same rows in state.imageInventory. Copy it to Downloads right after:
// /tmp does not survive a reboot.
//
// ⚠️ Read shapes are guarded, not assumed. On the FIRST run in a project, read the printed
// sample row per kind before trusting the counts: a kind with 0 rows on a site that visibly
// has those images is a read-shape problem, not an empty project.

const fs = require("fs")
const OUT = "/tmp/framer-launch"
fs.mkdirSync(OUT, { recursive: true })

// A dead module registry returns layout attrs only and every count comes back 0, silently
if (!(await framer.getCodeFiles()).length) throw new Error("getCodeFiles() is 0 — dead module registry. Open a new session.")

const IMG = /https:\/\/framerusercontent\.com\/(?:images|assets)\/([A-Za-z0-9_-]+)\.(png|jpe?g|webp|gif|svg|avif)/g
const hashesIn = (v) => [...(typeof v === "string" ? v : JSON.stringify(v ?? "")).matchAll(IMG)].map((m) => ({ hash: m[1], url: m[0] }))
// Layer names Framer took from the dropped file, Framer's own defaults, and tool names
const BAD_NAME = /chatgpt|dall[-_ ]?e|midjourney|firefly|stable[-_ ]?diffusion|gemini|copilot|generated|screenshot|screen[-_ ]?shot|untitled|image[-_ ]?\d|img[-_ ]?\d|dsc[-_ ]?\d|photo[-_ ]?\d|\bfinal\b|\bcopy\b|kopia|\(\d\)|^\d+$|[a-f0-9]{16,}|^(image|frame|rectangle|group|graphic|bild)( \d+)?$/i
const rows = []
const sample = {}
const list = (r) => (Array.isArray(r) ? r : r?.nodes ?? Object.values(r ?? {}))
// Attributes may sit at the top level or under .attributes depending on the read — merge both
const flat = (n) => ({ ...n, ...(n?.attributes ?? {}) })
async function serializeAll(ids) {
  const out = []
  for (let i = 0; i < ids.length; i += 25) out.push(...list(await framer.agent.serializeNodes({ ids: ids.slice(i, i + 25), depth: 0 })).map(flat))
  return out
}
const idsOf = async (type) => list(await framer.agent.getNodesOfTypes({ types: [type] })).map((n) => n.id)

// 1 · Frames with an image fill. Replicas are recorded with their primary so repoint.js can
//     write the primary first and then only the replicas that still carry an override.
for (const a of await serializeAll(await idsOf("FrameNode"))) {
  const hits = hashesIn(a.fill)
  if (!hits.length) continue
  sample.frame ??= a
  for (const h of hits) rows.push({ kind: "frame", id: a.id, name: a.name ?? null, scope: a.$scopeId ?? null, isReplica: !!a.$isReplica, originalId: a.$originalId ?? null, ...h, alt: a.altText ?? null })
}

// 2 · Component instances whose controls carry an image. Write path: .src + .alt, ONE command
for (const a of await serializeAll(await idsOf("ComponentInstanceNode"))) {
  for (const [k, v] of Object.entries(a)) {
    if (!k.startsWith("$control__")) continue
    for (const h of hashesIn(v)) {
      sample.instance ??= { id: a.id, key: k, value: v }
      rows.push({ kind: "instance", id: a.id, name: a.name ?? null, scope: a.$scopeId ?? null, isReplica: !!a.$isReplica, originalId: a.$originalId ?? null, control: k, ...h, alt: typeof v === "object" ? v?.alt ?? null : null })
    }
  }
}

// 3 · CMS. Image fields read at value.url explicitly — an ImageAsset's url may be a getter
//     that JSON.stringify skips. Rich text and file fields are reported, not written.
const cmsUrl = (v) => v?.value?.url ?? v?.url ?? (typeof v?.value === "string" ? v.value : null)
for (const c of await framer.getCollections()) {
  const fields = await c.getFields()
  const img = fields.filter((f) => f.type === "image")
  const other = fields.filter((f) => ["array", "formattedText", "file"].includes(f.type))
  if (!img.length && !other.length) continue
  for (const item of await c.getItems()) {
    for (const f of img) {
      const v = item.fieldData?.[f.id]
      const u = cmsUrl(v)
      for (const h of hashesIn(u ?? v)) {
        sample.cms ??= { collection: c.name, field: f.name, value: v, url: u }
        rows.push({ kind: "cms", collection: c.name, collectionId: c.id, itemId: item.id, slug: item.slug, fieldId: f.id, field: f.name, ...h, alt: v?.value?.altText ?? v?.altText ?? null })
      }
    }
    for (const f of other) for (const h of hashesIn(item.fieldData?.[f.id])) rows.push({ kind: f.type === "array" ? "cms-gallery" : f.type === "file" ? "cms-file" : "cms-richtext", collection: c.name, itemId: item.id, slug: item.slug, fieldId: f.id, field: f.name, ...h, alt: null, byHand: true })
  }
}

// 4 · Page and site metadata: social image, favicon, touch icon. keep: true downstream —
//     these stay PNG/JPG, never WebP
for (const a of await serializeAll(["rootNode", ...(await idsOf("WebPageNode"))])) {
  for (const [k, v] of Object.entries(a.metadata ?? {})) for (const h of hashesIn(v)) rows.push({ kind: "metadata", id: a.id, path: a.path ?? "(site)", field: k, ...h, alt: null })
}

for (const r of rows) r.badName = !!(r.name && BAD_NAME.test(r.name))
const byHash = {}
for (const r of rows) (byHash[r.hash] ||= []).push(r)
fs.writeFileSync(`${OUT}/inventory.json`, JSON.stringify({ at: new Date().toISOString(), rows, byHash: Object.fromEntries(Object.entries(byHash).map(([h, rs]) => [h, rs.length])) }, null, 2))
state.imageInventory = rows

const count = (k) => rows.filter((r) => r.kind === k).length
console.log(`frames ${count("frame")} (${rows.filter((r) => r.kind === "frame" && r.isReplica).length} replicas) · instances ${count("instance")} · cms ${count("cms")} · by hand: gallery ${count("cms-gallery")} richtext ${count("cms-richtext")} file ${count("cms-file")} · metadata ${count("metadata")} · unique images ${Object.keys(byHash).length} · bad layer names ${rows.filter((r) => r.badName).length}`)
console.log("sample rows (check the shapes before trusting the counts):", JSON.stringify(sample).slice(0, 1500))
