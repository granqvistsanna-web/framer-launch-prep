#!/usr/bin/env node
// Build the image manifest and the approval sheet, show it, and read the approved sheet back.
//
//   node manifest.mjs build  <workDir> <brandSlug>  scan/baseline/scan.json + images/inventory.json
//                                                   → images/manifest.json + images/alt-texts.csv
//   node manifest.mjs review <workDir>              images/alt-texts.csv → images/review.html
//                                                   (contact sheet: picture, name, alt, per row)
//   node manifest.mjs csv-in <workDir>              images/alt-texts.csv → manifest.json
//                                                   Refuses to write on any error.
//
// Names drafted by `build` are placeholders from the layer name. Claude looks at every
// original and writes the real name and alt into the CSV before the owner sees it.

import fs from "node:fs"
import path from "node:path"

const [cmd, dirArg, brandArg] = process.argv.slice(2)
if (!dirArg) { console.error("usage: node manifest.mjs build <workDir> <brandSlug> | review <workDir> | csv-in <workDir>"); process.exit(1) }
const workDir = path.resolve(dirArg)
const img = (f) => path.join(workDir, "images", f)
const BAD = /chatgpt|dall[-_ ]?e|midjourney|firefly|stable[-_ ]?diffusion|gemini|copilot|generated|screenshot|screen[-_ ]?shot|untitled|image[-_ ]?\d|img[-_ ]?\d|dsc[-_ ]?\d|photo[-_ ]?\d|\bfinal\b|\bcopy\b|kopia|\(\d\)|^\d+$|[a-f0-9]{16,}|^(image|frame|rectangle|group|graphic|bild)( \d+)?$/i
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ø/gi, "o").replace(/æ/gi, "ae").replace(/ß/g, "ss")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).replace(/-+$/, "")
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const COLS = ["hash", "preview", "current_layer_name", "bad_name", "new_name", "alt", "decorative", "usages", "pages", "uploaded_px", "max_render_px", "current_alt", "notes"]

function parseCsv(raw) {
  if (raw.includes("�")) throw new Error("the CSV contains � — it was saved in the wrong encoding. Save as CSV UTF-8 and try again")
  const t = raw.replace(/^﻿/, "")
  // Swedish Excel and Numbers save with ";" — read the delimiter off the header row
  const head = t.slice(0, t.search(/\r?\n/))
  const D = (head.match(/;/g) || []).length > (head.match(/,/g) || []).length ? ";" : ","
  const rows = []; let row = [], cell = "", q = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) { if (c === '"' && t[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') q = false; else cell += c }
    else if (c === '"') q = true
    else if (c === D) { row.push(cell); cell = "" }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = "" }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [h, ...body] = rows.filter((r) => r.some((x) => x !== ""))
  const names = h.map((x) => x.trim())
  for (const need of ["hash", "new_name", "alt", "decorative"]) if (!names.includes(need)) throw new Error(`the CSV has no "${need}" column (read with delimiter "${D}")`)
  return body.map((r) => Object.fromEntries(names.map((n, i) => [n, r[i] ?? ""])))
}
const csvCell = (v) => { const s = String(v ?? ""); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

if (cmd === "build") {
  const brand = slug(brandArg || "")
  if (!brand) { console.error("usage: node manifest.mjs build <workDir> <brandSlug>"); process.exit(1) }
  const scan = JSON.parse(fs.readFileSync(path.join(workDir, "scan", "baseline", "scan.json"), "utf8"))
  const invPath = img("inventory.json")
  const inv = fs.existsSync(invPath) ? JSON.parse(fs.readFileSync(invPath, "utf8")).rows : []
  if (!inv.length) console.error("⚠️ no images/inventory.json — manifest from the published site only; canvas usages unknown")
  const rows = new Map()
  for (const i of scan.images) rows.set(i.hash, { hash: i.hash, src: i.src, maxRenderPx: i.maxRenderPx || null, uploadedPx: i.intrinsicW, pages: i.pages, currentAlt: i.alts.join(" / "), usages: [], names: new Set(), kinds: new Set() })
  for (const r of inv) {
    const e = rows.get(r.hash) || { hash: r.hash, src: r.url, maxRenderPx: null, uploadedPx: null, pages: [], currentAlt: r.alt ?? "", usages: [], names: new Set(), kinds: new Set(), unpublished: true }
    e.usages.push({ kind: r.kind, id: r.id ?? r.itemId, control: r.control, field: r.field })
    e.kinds.add(r.kind)
    if (r.name) e.names.add(r.name)
    rows.set(r.hash, e)
  }
  let n = 0
  const out = [...rows.values()].map((e) => {
    const name = [...e.names][0] || ""
    const bad = [...e.names].some((x) => BAD.test(x))
    const base = !bad && name ? slug(name) : `image-${String(++n).padStart(2, "0")}`
    const ext = path.extname(new URL(e.src).pathname)
    // Favicon, touch icon and social image stay PNG/JPG: iOS and social scrapers need them
    const keep = e.kinds.has("metadata")
    return { hash: e.hash, src: e.src, brand, maxRenderPx: e.maxRenderPx, uploadedPx: e.uploadedPx, pages: e.pages, currentAlt: e.currentAlt,
      layerNames: [...e.names], badName: bad, usages: e.usages, unpublished: !!e.unpublished, keep,
      newName: base.startsWith(brand + "-") ? base : `${brand}-${base}`, alt: "", decorative: false, preview: `images/original/${e.hash}${ext}` }
  })
  fs.mkdirSync(path.join(workDir, "images"), { recursive: true })
  fs.writeFileSync(img("manifest.json"), JSON.stringify(out, null, 2))
  const csv = [COLS.join(","), ...out.map((r) => [r.hash, r.preview, r.layerNames.join(" / "), r.badName ? "yes" : "", r.newName, r.alt, r.decorative ? "yes" : "", r.usages.length, r.pages.join(" "), r.uploadedPx ?? "", r.maxRenderPx ?? "", r.currentAlt, [r.unpublished ? "not on the published site" : "", r.keep ? "icon/social image: stays PNG/JPG" : ""].filter(Boolean).join("; ")].map(csvCell).join(","))]
  fs.writeFileSync(img("alt-texts.csv"), csv.join("\n") + "\n")
  console.log(`${out.length} images · ${out.filter((r) => r.badName).length} bad layer names · ${out.filter((r) => r.unpublished).length} only on the canvas → images/alt-texts.csv`)
} else if (cmd === "review") {
  const sheet = parseCsv(fs.readFileSync(img("alt-texts.csv"), "utf8"))
  const cards = sheet.map((r, i) => `<figure><img src="../${esc(r.preview)}" alt="" loading="lazy"><figcaption><b>${i + 1}</b> <code>${esc(r.new_name)}</code>
<p>${/^(y|yes|ja|x|true|1)$/i.test(r.decorative.trim()) ? "<em>decorative, empty alt</em>" : esc(r.alt) || "<mark>no alt yet</mark>"}</p>
<small>${esc(r.usages)} usage(s) · ${esc(r.pages || "canvas only")}${r.current_layer_name ? ` · was «${esc(r.current_layer_name)}»` : ""}${r.bad_name ? " · <mark>bad name</mark>" : ""}</small></figcaption></figure>`).join("\n")
  fs.writeFileSync(img("review.html"), `<!doctype html><meta charset="utf-8"><title>Image review</title>
<style>body{font:14px/1.45 -apple-system,sans-serif;margin:24px;background:#fff;color:#111}h1{font-size:20px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px}
figure{margin:0;border:1px solid #ddd;border-radius:10px;overflow:hidden}img{width:100%;height:200px;object-fit:contain;background:#f3f3f3}
figcaption{padding:10px 12px}code{font-size:12px}p{margin:6px 0}small{color:#666}mark{background:#ffe08a}
@media (prefers-color-scheme:dark){body{background:#111;color:#eee}figure{border-color:#333}img{background:#222}small{color:#999}}</style>
<h1>Image names and alt texts: ${sheet.length} images</h1>
<p>Reply "approved", or give changes by number. To edit directly, open <code>alt-texts.csv</code>.</p>
<main>${cards}</main>`)
  console.log(`wrote images/review.html (${sheet.length} images)`)
} else if (cmd === "csv-in") {
  const man = JSON.parse(fs.readFileSync(img("manifest.json"), "utf8"))
  let sheet
  try { sheet = Object.fromEntries(parseCsv(fs.readFileSync(img("alt-texts.csv"), "utf8")).map((r) => [r.hash.trim(), r])) }
  catch (e) { console.error(`✗ ${e.message} — manifest not changed`); process.exit(1) }
  const errors = []
  const seen = new Map()
  let skipped = 0
  for (const r of man) {
    const s = sheet[r.hash]; if (!s) { r.skip = true; skipped++; continue }
    const base = slug(s.new_name) || r.newName
    r.newName = r.brand && !base.startsWith(r.brand + "-") && base !== r.brand ? `${r.brand}-${base}`.slice(0, 60).replace(/-+$/, "") : base
    r.alt = s.alt.replace(/\s+/g, " ").trim()
    r.decorative = /^(y|yes|ja|x|true|1)$/i.test(s.decorative.trim())
    r.skip = !r.alt && !r.decorative && !r.keep
    if (r.skip) { skipped++; continue }
    if (seen.has(r.newName)) errors.push(`duplicate new_name "${r.newName}" (${seen.get(r.newName).slice(0, 8)} and ${r.hash.slice(0, 8)})`)
    seen.set(r.newName, r.hash)
    if (r.alt.length > 125) console.error(`⚠️ alt over 125 chars: ${r.newName}`)
    if (/^(image|picture|photo|bild|foto) (of|på)/i.test(r.alt)) console.error(`⚠️ alt starts with "image of": ${r.newName}`)
  }
  if (errors.length) { for (const e of errors) console.error(`✗ ${e}`); console.error("manifest not changed — fix the CSV and run csv-in again"); process.exit(1) }
  fs.writeFileSync(img("manifest.json"), JSON.stringify(man, null, 2))
  console.log(`${man.length - skipped} ready · ${skipped} skipped (no alt and not decorative)`)
} else {
  console.error("usage: node manifest.mjs build <workDir> <brandSlug> | review <workDir> | csv-in <workDir>"); process.exit(1)
}
