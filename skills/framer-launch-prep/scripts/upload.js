// Framer exec script — uploads the optimised files. Writes nothing to the canvas.
//
//   cp "<workDir>/images/optimised/"* /tmp/framer-launch/optimised/
//   cp "<workDir>/images/manifest.json" /tmp/framer-launch/manifest.json
//   npx @framer/agent@latest exec -s <id> < upload.js
//
// Needs, per manifest row: hash, newName, outFile, alt (approved by the owner), decorative?
// Writes /tmp/framer-launch/uploaded.json: { [hash]: { url, name, error? } }. Re-runnable:
// rows already uploaded are skipped, so a crash mid-run costs nothing.
//
// Transport: a base64 data: URI string. {bytes, mimeType} fails the cross-realm check from
// exec, and File/Blob do not exist in the VM. One project measured a Connection error at
// 551 KB, another uploaded 4.7 MB — so anything over 500 KB is attempted last, and a
// failure there goes on the owner's drag-and-drop list instead of being retried in a loop.

const fs = require("fs")
const DIR = "/tmp/framer-launch"
if (!(await framer.getCodeFiles()).length) throw new Error("getCodeFiles() is 0 — dead module registry. Open a new session.")
const rows = JSON.parse(fs.readFileSync(`${DIR}/manifest.json`, "utf8")).filter((r) => r.outFile && !r.skip)
const donePath = `${DIR}/uploaded.json`
const done = fs.existsSync(donePath) ? JSON.parse(fs.readFileSync(donePath, "utf8")) : {}
const mime = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".gif": "image/gif", ".avif": "image/avif" }

const file = (r) => `${DIR}/optimised/${r.outFile.split("/").pop()}`
const missing = rows.filter((r) => !fs.existsSync(file(r)))
if (missing.length) throw new Error(`${missing.length} optimised files not staged in ${DIR}/optimised — first: ${file(missing[0])}`)
rows.sort((a, b) => fs.statSync(file(a)).size - fs.statSync(file(b)).size)

for (const r of rows) {
  if (done[r.hash]?.url) continue
  const f = file(r)
  const ext = f.slice(f.lastIndexOf(".")).toLowerCase()
  const b64 = fs.readFileSync(f).toString("base64")
  try {
    const asset = await framer.uploadImage({
      image: `data:${mime[ext]};base64,${b64}`,
      name: r.newName + ext,
      altText: r.decorative ? "" : r.alt,
      resolution: "full",
    })
    done[r.hash] = { url: asset.url, name: r.newName + ext }
    console.log(`✓ ${r.newName}${ext} → ${asset.url}`)
  } catch (e) {
    done[r.hash] = { error: String(e.message || e).slice(0, 200), name: r.newName + ext, bytes: fs.statSync(f).size }
    console.log(`✗ ${r.newName}${ext}: ${done[r.hash].error}`)
  }
  fs.writeFileSync(donePath, JSON.stringify(done, null, 2))
}
const failed = Object.values(done).filter((d) => d.error)
console.log(`${Object.values(done).filter((d) => d.url).length} uploaded · ${failed.length} failed${failed.length ? " → the owner's drag-and-drop list" : ""}`)
