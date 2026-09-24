#!/usr/bin/env node
// Lighthouse, mobile and desktop, on a PUBLISHED Framer URL. Uses local Chrome through
// `npx lighthouse`; no API key.
//
//   node lighthouse.mjs <origin> <outDir> <label> [--paths /,/pricing] [--runs 3] [--desktop]
//
// <label> is "baseline" or "final" (or any word) — reports land in <outDir>/<label>/.
// With --runs > 1 the MEDIAN performance run is kept: one Lighthouse run swings ±10 points.
// Writes <outDir>/<label>/summary.md and summary.json. Compare two labels with --compare a,b.

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : undefined }
const [origin0, outDir, label] = args
const origin = (origin0 || "").replace(/\/$/, "")

if (flag("--compare")) {
  const [a, b] = flag("--compare").split(",")
  const A = JSON.parse(fs.readFileSync(path.join(outDir, a, "summary.json")))
  const B = JSON.parse(fs.readFileSync(path.join(outDir, b, "summary.json")))
  const L = [`| Page | Form | Perf | A11y | BP | SEO | LCP s | CLS | TBT ms |`, `|---|---|---|---|---|---|---|---|---|`]
  // Union of both runs: a page only in one of them still shows, with the missing side as "—"
  const d = (x, y) => (x == null && y == null ? "—" : x == null ? `— → ${y}` : y == null ? `${x} → —` : x === y ? `${y}` : `${x} → **${y}**`)
  const keys = [...new Set([...A, ...B].map((r) => `${r.path}\t${r.form}`))]
  for (const k of keys) {
    const [p, f] = k.split("\t")
    const o = A.find((x) => x.path === p && x.form === f) || {}
    const r = B.find((x) => x.path === p && x.form === f) || {}
    L.push(`| ${p} | ${f} | ${d(o.perf, r.perf)} | ${d(o.a11y, r.a11y)} | ${d(o.bp, r.bp)} | ${d(o.seo, r.seo)} | ${d(o.lcp, r.lcp)} | ${d(o.cls, r.cls)} | ${d(o.tbt, r.tbt)} |`)
  }
  const out = path.join(outDir, `compare-${a}-${b}.md`)
  fs.writeFileSync(out, `# Lighthouse ${a} → ${b}\n\n${L.join("\n")}\n`)
  console.log(fs.readFileSync(out, "utf8"))
  process.exit(0)
}

if (!origin.startsWith("http") || !outDir || !label) {
  console.error("usage: node lighthouse.mjs <origin> <outDir> <label> [--paths /,/a] [--runs 3] [--desktop]\n       node lighthouse.mjs - <outDir> - --compare baseline,final")
  process.exit(1)
}
const paths = (flag("--paths") || "/").split(",").map((p) => p.trim())
const runs = Number(flag("--runs") || 1)
const forms = args.includes("--desktop") ? ["mobile", "desktop"] : ["mobile"]
const dir = path.join(outDir, label)
fs.mkdirSync(dir, { recursive: true })

const slug = (p) => (p === "/" ? "home" : p.replace(/^\/|\/$/g, "").replace(/[^a-z0-9]+/gi, "-"))
const rows = []

for (const p of paths) for (const form of forms) {
  const results = []
  for (let i = 0; i < runs; i++) {
    const base = path.join(dir, `${slug(p)}-${form}${runs > 1 ? "-" + (i + 1) : ""}`)
    const cli = ["-y", "lighthouse@12", origin + p, "--quiet", "--output=json", "--output=html", `--output-path=${base}`,
      "--chrome-flags=--headless=new --no-sandbox", "--max-wait-for-load=60000"]
    if (form === "desktop") cli.push("--preset=desktop")
    try { execFileSync("npx", cli, { stdio: ["ignore", "ignore", "pipe"], timeout: 240000 }) }
    catch (e) { console.error(`lighthouse failed on ${p} ${form}: ${String(e.stderr || e).slice(0, 300)}`); continue }
    const j = JSON.parse(fs.readFileSync(base + ".report.json", "utf8"))
    // A runtime error can exit 0 with every score null — that run does not count
    if (j.runtimeError || j.categories?.performance?.score == null) { console.error(`lighthouse run invalid on ${p} ${form}: ${j.runtimeError?.message || "no performance score"}`); continue }
    results.push({ j, base })
  }
  if (!results.length) continue
  // Lower-middle run: the median for odd counts, the more conservative of the two for even
  results.sort((a, b) => a.j.categories.performance.score - b.j.categories.performance.score)
  const { j, base } = results[Math.floor((results.length - 1) / 2)]
  const s = (k) => Math.round((j.categories[k]?.score ?? 0) * 100)
  const a = j.audits
  const num = (id, f) => (a[id]?.numericValue == null ? null : f(a[id].numericValue))
  const failing = Object.values(a)
    .filter((x) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== "informative" && x.scoreDisplayMode !== "manual" && x.scoreDisplayMode !== "notApplicable")
    .sort((x, y) => (y.details?.overallSavingsMs || 0) - (x.details?.overallSavingsMs || 0) || x.score - y.score)
    .slice(0, 12)
    .map((x) => ({ id: x.id, title: x.title, display: x.displayValue || "", items: x.details?.items?.length || 0 }))
  rows.push({
    path: p, form, report: path.basename(base) + ".report.html",
    perf: s("performance"), a11y: s("accessibility"), bp: s("best-practices"), seo: s("seo"),
    runs: results.length,
    lcp: num("largest-contentful-paint", (v) => +(v / 1000).toFixed(1)),
    cls: num("cumulative-layout-shift", (v) => +v.toFixed(3)),
    tbt: num("total-blocking-time", Math.round),
    lcpElement: a["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]?.node?.snippet?.slice(0, 160) || null,
    // TTFB / load delay / load time / render delay. A big render delay on an image that loaded
    // early points at something holding the paint back (an appear effect, hydration), not bytes
    lcpPhases: (a["largest-contentful-paint-element"]?.details?.items?.[1]?.items || []).map((x) => `${x.phase} ${Math.round(x.timing)} ms (${x.percent})`).join(" · ") || null,
    weightKB: Math.round((a["total-byte-weight"]?.numericValue || 0) / 1024),
    failing,
  })
  console.error(`${p} ${form}: perf ${s("performance")} a11y ${s("accessibility")} bp ${s("best-practices")} seo ${s("seo")}`)
}

fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(rows, null, 2))
const L = [`# Lighthouse — ${label} — ${origin}`, "", `${new Date().toISOString()} · ${runs} run(s) asked per page, median (lower-middle) performance kept · Lighthouse 12 · a row with fewer valid runs says so`, "",
  "| Page | Form | Perf | A11y | BP | SEO | LCP s | CLS | TBT ms | Weight KB |", "|---|---|---|---|---|---|---|---|---|---|"]
for (const r of rows) L.push(`| ${r.path}${r.runs < runs ? ` (n=${r.runs})` : ""} | ${r.form} | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.seo} | ${r.lcp} | ${r.cls} | ${r.tbt} | ${r.weightKB} |`)
for (const r of rows) {
  L.push("", `## ${r.path} · ${r.form}`, "", `Report: \`${r.report}\``)
  if (r.lcpElement) L.push("", `LCP element: \`${r.lcpElement.replace(/`/g, "'")}\``)
  if (r.lcpPhases) L.push("", `LCP phases: ${r.lcpPhases}`)
  L.push("", ...r.failing.map((f) => `- ${f.title}${f.display ? ` — ${f.display}` : ""}${f.items ? ` (${f.items})` : ""} \`${f.id}\``))
}
fs.writeFileSync(path.join(dir, "summary.md"), L.join("\n") + "\n")
console.log(`wrote ${path.join(dir, "summary.md")}`)
