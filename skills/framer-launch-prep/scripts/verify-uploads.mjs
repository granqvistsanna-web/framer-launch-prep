#!/usr/bin/env node
// Prove every uploaded asset is the picture we sent. Framer has been measured re-hosting an
// image as a DIFFERENT photograph while keeping the alt text, so the alt then describes the
// wrong picture. A screenshot is not proof; bytes are.
//
//   cp /tmp/framer-launch/uploaded.json "<workDir>/images/uploaded.json"
//   node verify-uploads.mjs <workDir>
//   cp "<workDir>/images/uploaded.json" /tmp/framer-launch/uploaded.json
//
// Marks each row verified: true | false in uploaded.json. repoint.js touches verified rows only.
//
// Two tests, strictest first:
//  1. byte-identical (SHA-256) to the local optimised file → verified
//  2. otherwise same pixel dimensions AND mean abs diff < 2.5 at 256×256 greyscale. A loose
//     64×64 colour check was measured passing a different product photo at 6.5, so the bound
//     is tight and the size must match exactly. A near-miss fails; a human looks at it.
// SVG must be byte-identical and served as image/svg+xml.

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const workDir = path.resolve(process.argv[2] || "")
const sharp = createRequire(path.join(workDir, ".tools", "x.js"))("sharp")
const upPath = path.join(workDir, "images", "uploaded.json")
const up = JSON.parse(fs.readFileSync(upPath, "utf8"))
const man = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(workDir, "images", "manifest.json"), "utf8")).map((r) => [r.hash, r]))
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex")
const grey = (buf) => sharp(buf, { failOn: "none" }).flatten({ background: "#fff" }).greyscale().resize(256, 256, { fit: "fill" }).raw().toBuffer()

let ok = 0, total = 0
for (const [hash, u] of Object.entries(up)) {
  if (!u.url) continue
  total++
  try {
    const local = fs.readFileSync(path.join(workDir, man[hash].outFile))
    const ext = path.extname(man[hash].outFile).toLowerCase()
    const mime = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml" }[ext]
    // Ask for exactly what we uploaded, so Framer has no reason to re-encode it
    const res = await fetch(u.url, { headers: { accept: `${mime},*/*;q=0.1` } })
    if (!res.ok) throw new Error(`fetch ${res.status}`)
    const remote = Buffer.from(await res.arrayBuffer())
    u.servedAs = res.headers.get("content-type")
    if (sha(local) === sha(remote)) { u.verified = true; u.check = "bytes identical" }
    else if (ext === ".svg") { u.verified = false; u.check = `svg bytes differ (served ${u.servedAs})` }
    else {
      const [ml, mr] = await Promise.all([sharp(local).metadata(), sharp(remote).metadata()])
      const [a, b] = await Promise.all([grey(local), grey(remote)])
      let diff = 0
      for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i])
      u.meanDiff = +(diff / a.length).toFixed(2)
      u.dims = `${ml.width}x${ml.height} vs ${mr.width}x${mr.height}`
      u.verified = ml.width === mr.width && ml.height === mr.height && u.meanDiff < 2.5
      u.check = `pixels: diff ${u.meanDiff}, ${u.dims}`
    }
    if (ext === ".svg" && !/svg/.test(u.servedAs || "")) { u.verified = false; u.check += ` · served as ${u.servedAs}, not SVG` }
  } catch (e) { u.verified = false; u.check = `error: ${String(e.message || e).slice(0, 160)}` }
  if (u.verified) ok++
  console.error(`${u.verified ? "✓" : "✗"} ${u.name}  ${u.check}`)
}
fs.writeFileSync(upPath, JSON.stringify(up, null, 2))
console.log(`${ok}/${total} verified${ok < total ? " — look at every ✗ before repointing; none of them will be touched" : ""}`)
