#!/usr/bin/env node
// Download every image in the manifest at full resolution, resize it to what the site
// actually needs, re-encode, and write it under its new name.
//
//   node optimise-images.mjs <workDir> [--download-only]
//
// --download-only fetches the originals and stops, so they can be LOOKED AT before names
// and alt are written (Phase 1 step 2). Run it again without the flag after the gate.
//
// Reads  <workDir>/images/manifest.json   — from manifest.mjs; rows with skip: true are left alone
// Writes <workDir>/images/original/<hash>.<ext>     untouched download (the backup)
//        <workDir>/images/optimised/<newName>.<ext> what gets uploaded
//        <workDir>/images/manifest.json             same rows + bytes, dims, outFile
//
// Why resize at all when Framer already serves WebP and a srcset: the srcset's top
// candidate IS the uploaded file. A 3600px upload drawn at 412px on a 2.6x phone skips
// the 1024w candidate and downloads all 3600px. Bounding the source bounds the worst case.
//
// sharp is installed on first run into <workDir>/.tools — nothing lands in the repo.

import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

if (!process.argv[2]) { console.error("usage: node optimise-images.mjs <workDir> [--download-only]"); process.exit(1) }
const workDir = path.resolve(process.argv[2])
const tools = path.join(workDir, ".tools")
if (!process.argv.includes("--download-only") && !fs.existsSync(path.join(tools, "node_modules", "sharp"))) {
  fs.mkdirSync(tools, { recursive: true })
  execSync("npm i --silent --no-audit --no-fund --prefix . sharp@0.34", { cwd: tools, stdio: "inherit" })
}
const DL = process.argv.includes("--download-only")
const sharp = DL ? null : createRequire(path.join(tools, "x.js"))("sharp")

const MIN_W = 800, MAX_W = 2560, DPR = 2
const manifestPath = path.join(workDir, "images", "manifest.json")
const rows = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
const origDir = path.join(workDir, "images", "original")
const optDir = path.join(workDir, "images", "optimised")
fs.mkdirSync(origDir, { recursive: true }); fs.mkdirSync(optDir, { recursive: true })

const kb = (n) => Math.round(n / 1024)
let before = 0, after = 0
const save = () => fs.writeFileSync(manifestPath, JSON.stringify(rows, null, 2))

// Two rows with one name would write one file for two pictures
const names = {}
for (const r of rows) if (!r.skip) (names[r.newName] ||= []).push(r.hash)
const dups = Object.entries(names).filter(([, h]) => h.length > 1)
if (dups.length && !DL) { console.error(`✗ duplicate newName: ${dups.map(([n]) => n).join(", ")} — run manifest.mjs csv-in after fixing the CSV`); process.exit(1) }

for (const r of rows) {
  if (r.skip && !DL) continue
  try {
    const ext = (path.extname(new URL(r.src).pathname) || ".png").toLowerCase()
    const orig = path.join(origDir, r.hash + ext)
    if (!fs.existsSync(orig)) {
      // Ask for the original bytes, not Framer's negotiated WebP
      const res = await fetch(r.src.split("?")[0], { headers: { accept: "image/png,image/jpeg,image/svg+xml,*/*;q=0.1" } })
      if (!res.ok) { r.error = `download ${res.status}`; console.error(`✗ ${r.hash} ${r.error}`); continue }
      fs.writeFileSync(orig, Buffer.from(await res.arrayBuffer()))
    }
    r.originalFile = path.relative(workDir, orig)
    r.originalBytes = fs.statSync(orig).size
    if (DL) continue

    // Every raster image leaves as WebP (house rule). SVG stays SVG: it is vector, and a
    // WebP of it would be bigger and blurry. `keep: true` in the manifest opts a row out.
    if (r.keep || ext === ".svg") {
      const out = path.join(optDir, r.newName + ext)
      fs.copyFileSync(orig, out)
      Object.assign(r, { outFile: path.relative(workDir, out), outBytes: r.originalBytes, action: "renamed only" })
      before += r.originalBytes; after += r.originalBytes
      continue
    }

    const animated = ext === ".gif"
    const m = await sharp(orig, { failOn: "none", animated }).metadata()
    const need = r.maxRenderPx ? Math.ceil(r.maxRenderPx * DPR) : MAX_W
    const target = Math.min(m.width, Math.max(MIN_W, Math.min(MAX_W, need)))
    const out = path.join(optDir, r.newName + ".webp")
    // .rotate() applies EXIF orientation before metadata is stripped (sharp strips by default)
    const encode = (opts) => sharp(orig, { failOn: "none", animated }).rotate().resize({ width: target, withoutEnlargement: true }).webp({ effort: 6, ...opts }).toBuffer()
    // Quality 82 = the default of the manual converter (granqvistsanna-web.github.io/image-compressor),
    // so a file made there and a file made here look the same
    // Figma exports carry an alpha channel even when fully opaque; only real transparency gets 88
  const transparent = m.hasAlpha && !(await sharp(orig, { failOn: "none" }).stats()).isOpaque
  let buf = await encode({ quality: transparent ? 88 : 82, alphaQuality: 90, smartSubsample: true })
    // Flat graphics (logos, UI shots, PNG illustrations) often come out smaller lossless — keep the smaller WebP
    if (!animated && buf.length >= r.originalBytes) {
      const lossless = await encode({ lossless: true })
      if (lossless.length < buf.length) buf = lossless
    }
    fs.writeFileSync(out, buf)
    const outBytes = buf.length
    Object.assign(r, { outFile: path.relative(workDir, out), outBytes, action: `${m.width}→${target}px webp${animated ? " (animated)" : ""}${outBytes > r.originalBytes ? " ⚠️ larger than original" : ""}`, originalW: m.width, outW: target })
    before += r.originalBytes; after += r.outBytes
    console.error(`${r.action.padEnd(28)} ${kb(r.originalBytes)}→${kb(r.outBytes)} KB  ${r.newName}`)

  } catch (e) { r.error = String(e.message || e).slice(0, 200); console.error(`✗ ${r.newName}: ${r.error}`) }
  save()
}
save()
const failed = rows.filter((r) => r.error)
if (failed.length) console.error(`${failed.length} rows failed — see "error" in manifest.json; they are not uploaded`)
if (DL) console.log(`${rows.filter((r) => r.originalFile).length} originals in images/original/`)
else console.log(`${rows.length} images · ${kb(before)} KB → ${kb(after)} KB (${before ? Math.round((1 - after / before) * 100) : 0}% smaller)`)
