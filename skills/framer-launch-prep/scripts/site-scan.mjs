#!/usr/bin/env node
// Read-only pre-launch scan of a PUBLISHED Framer site: SEO basics, image/alt inventory,
// schema parse, script and iframe hygiene. No dependencies.
//
//   node site-scan.mjs <origin> <outDir> [--max 60] [--paths /a,/b]
//
// Writes <outDir>/scan.json (everything) and <outDir>/scan.md (the tables a person reads).
// Served HTML only — headings after hydration: verify-schema.mjs --headings.

import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const origin = (args[0] || "").replace(/\/$/, "")
const outDir = args[1]
if (!origin.startsWith("http") || !outDir) {
  console.error("usage: node site-scan.mjs <origin> <outDir> [--max 60] [--paths /a,/b]")
  process.exit(1)
}
const flag = (n) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : undefined }
const MAX = Number(flag("--max") || 60)
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"

const WEAK_ALT = /^(image|img|photo|picture|bild|foto|logo|icon|graphic|banner|hero)$|\.(png|jpe?g|webp|gif|svg|avif)$|^image of|^picture of|^bild på/i

const get = async (url, opts = {}) => {
  try {
    const r = await fetch(url, { redirect: opts.redirect || "follow", headers: { "user-agent": UA, accept: "text/html,*/*" }, signal: AbortSignal.timeout(45000) })
    return { status: r.status, url: r.url, headers: r.headers, text: opts.head ? "" : await r.text() }
  } catch (e) { return { status: 0, url, error: String(e), text: "" } }
}
const decode = (s = "") => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
// A bare attribute (Framer writes decorative images as `<img … alt …>`) returns ""
const attr = (tag, name) => { const m = new RegExp(`\\s${name}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+)))?(?=[\\s/>])`, "i").exec(tag); return m ? decode(m[1] ?? m[2] ?? m[3] ?? "") : null }
const meta = (html, key) => { for (const t of html.match(/<meta\b[^>]*>/gi) || []) if ((attr(t, "name") || attr(t, "property"))?.toLowerCase() === key) return attr(t, "content"); return null }
const text = (s) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
const hashOf = (u) => (/framerusercontent\.com\/(?:images|assets)\/([^/?#."]+)/.exec(u) || [])[1] || null

// Largest CSS px an image is ever drawn at, from its `sizes`. Each media clause is evaluated
// at the widest viewport it covers (open-ended min-width → 1440), and Framer's
// calc/min/max arithmetic is evaluated, not guessed from the biggest number in the string.
function evalLength(expr, vw) {
  const js = expr.replace(/calc\(/g, "(").replace(/(\d+(?:\.\d+)?)vw/g, (_, n) => `(${n}*${vw / 100})`).replace(/(\d+(?:\.\d+)?)px/g, "$1")
  if (!/^[\d\s.+\-*/(),minax]*$/.test(js)) return null
  try { return Function("min", "max", `return (${js})`)(Math.min, Math.max) } catch { return null }
}
const maxRenderPx = (sizes) => {
  if (!sizes) return null
  let max = 0
  for (const clause of sizes.split(/,(?![^()]*\))/)) {
    const media = (/^\s*(\([^]*\))\s+(?=[^()]*$|[a-z(])/i.exec(clause) || [])[1] || ""
    const value = clause.slice(clause.indexOf(media) + media.length).trim()
    const maxW = /max-width:\s*([\d.]+)px/.exec(media)
    const vw = maxW ? Number(maxW[1]) : 1440
    const px = evalLength(value, vw)
    if (Number.isFinite(px)) max = Math.max(max, px)
  }
  return Math.round(max) || null
}

async function pageList() {
  const explicit = flag("--paths")
  if (explicit) { const urls = explicit.split(",").map((p) => origin + p.trim()); return { urls, total: urls.length, templates: {} } }
  const sm = await get(origin + "/sitemap.xml")
  const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]).trim())
  // The sitemap lists the PRIMARY domain; scanning staging must not quietly scan production
  const urls = (locs.length ? locs : [origin + "/"]).map((u) => { const x = new URL(u); return origin + x.pathname + x.search })
  // Sample only folders big enough to be a CMS collection (> 5 siblings): two items each.
  // Smaller nested folders (/legal/*, /products/*) are static pages and are all scanned.
  const folder = (u) => { const p = new URL(u).pathname.split("/").filter(Boolean); return p.length > 1 ? p.slice(0, -1).join("/") : null }
  const size = {}
  for (const u of urls) { const f = folder(u); if (f) size[f] = (size[f] || 0) + 1 }
  const tplCount = {}
  const picked = []
  for (const u of urls) {
    const f = folder(u)
    if (f && size[f] > 5) { tplCount[f] = (tplCount[f] || 0) + 1; if (tplCount[f] > 2) continue }
    picked.push(u)
  }
  return { urls: picked.slice(0, MAX), total: urls.length, templates: tplCount }
}

function scanPage(url, res) {
  const html = res.text
  const p = { url, status: res.status, finalUrl: res.url, issues: [] }
  const issue = (sev, msg) => p.issues.push({ sev, msg })
  p.lang = (/<html\b[^>]*\slang="([^"]*)"/i.exec(html) || [])[1] || null
  p.title = text((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || "")
  p.description = meta(html, "description")
  p.canonical = (() => { for (const t of html.match(/<link\b[^>]*>/gi) || []) if (attr(t, "rel") === "canonical") return attr(t, "href"); return null })()
  p.robots = meta(html, "robots")
  p.og = { title: meta(html, "og:title"), description: meta(html, "og:description"), image: meta(html, "og:image"), locale: meta(html, "og:locale"), twitter: meta(html, "twitter:card") }

  if (!p.lang) issue("high", "no <html lang> — set the site language (WCAG 3.1.1)")
  if (!p.title) issue("high", "no <title>")
  else if (p.title.length > 60) issue("med", `title ${p.title.length} chars (>60)`)
  else if (p.title.length < 20) issue("low", `title ${p.title.length} chars (<20)`)
  if (!p.description) issue("high", "no meta description")
  else if (/made with framer/i.test(p.description)) issue("high", "meta description is the Framer default")
  else if (p.description.length > 160) issue("med", `description ${p.description.length} chars (>160)`)
  else if (p.description.length < 70) issue("low", `description ${p.description.length} chars (<70)`)
  if (/my framer site/i.test(p.title)) issue("high", "title is the Framer default")
  if (!p.canonical) issue("med", "no canonical")
  if (p.robots && /noindex/i.test(p.robots)) issue("info", "page is noindex")
  if (!p.og.image) issue("med", "no og:image")

  // Headings in served HTML (hydration can change these — confirm in a browser)
  p.headings = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ level: +m[1], text: text(m[2]).slice(0, 80) }))
  const h1 = p.headings.filter((h) => h.level === 1).length
  if (h1 === 0) issue("high", "no H1 in served HTML")
  if (h1 > 1) issue("med", `${h1} H1s in served HTML`)
  let prev = 0
  for (const h of p.headings) { if (prev && h.level > prev + 1) issue("low", `heading skip h${prev}→h${h.level} at "${h.text}"`); prev = h.level }

  // Images: <img>, background-image, og
  p.images = []
  for (const t of html.match(/<img\b[^>]*>/gi) || []) {
    const src = attr(t, "src") || ""
    const alt = attr(t, "alt")
    const w = Number(attr(t, "width")) || null
    const render = maxRenderPx(attr(t, "sizes"))
    p.images.push({ src: src.split("?")[0], hash: hashOf(src), alt, intrinsicW: w, maxRenderPx: render, loading: attr(t, "loading"), priority: attr(t, "fetchpriority") })
  }
  for (const m of html.matchAll(/background-image:\s*url\((?:&quot;|["'])?([^)"'&]+)/gi)) p.images.push({ src: m[1].split("?")[0], hash: hashOf(m[1]), alt: null, css: true })
  const noAlt = p.images.filter((i) => !i.css && i.alt === null).length
  const weak = p.images.filter((i) => i.alt && WEAK_ALT.test(i.alt.trim())).length
  const oversized = p.images.filter((i) => i.intrinsicW && i.maxRenderPx && i.intrinsicW > i.maxRenderPx * 2.2 && i.intrinsicW > 1200 && !/\.svg$/i.test(i.src)).length
  if (noAlt) issue("high", `${noAlt} <img> with no alt attribute at all`)
  if (weak) issue("med", `${weak} images with placeholder-like alt`)
  if (oversized) issue("med", `${oversized} images uploaded far wider than they render`)

  // JSON-LD: parse, never grep
  p.schema = []
  for (const m of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = m[1].trim()
    try {
      const j = JSON.parse(raw)
      const nodes = Array.isArray(j) ? j : j["@graph"] || [j]
      p.schema.push({ ok: true, types: nodes.map((n) => n["@type"]).flat() })
    } catch (e) { p.schema.push({ ok: false, error: String(e.message).slice(0, 120), unrendered: raw.includes("{{") }) }
  }
  if (!p.schema.length) issue("med", "no JSON-LD")
  for (const s of p.schema) if (!s.ok) issue("high", `JSON-LD does not parse${s.unrendered ? " (unrendered {{…}})" : ""}: ${s.error}`)

  // Third-party scripts and iframes
  p.scripts = []
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
    const src = attr(m[0], "src")
    if (!src || /framer(usercontent)?\.com|framerstatic|framer\.website|framer\.app/.test(src)) continue
    const blocking = !/\s(async|defer)\b/i.test(m[1]) && attr(m[0], "type") !== "module"
    p.scripts.push({ src, blocking })
    if (blocking) issue("high", `render-blocking third-party script: ${src.slice(0, 90)}`)
  }
  p.iframes = (html.match(/<iframe\b[^>]*>/gi) || []).map((t) => ({ src: attr(t, "src"), loading: attr(t, "loading"), title: attr(t, "title") }))
  for (const f of p.iframes) {
    if (!f.title) issue("med", `iframe without title: ${String(f.src).slice(0, 70)}`)
    if (f.loading !== "lazy") issue("low", `iframe not lazy: ${String(f.src).slice(0, 70)}`)
  }

  // Links: empty names, links to drafts (Framer renders them as href="./")
  const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
  const unnamed = anchors.filter((m) => !text(m[2]) && !attr(m[0], "aria-label") && !attr(m[0], "aria-labelledby") && !attr(m[0], "title") && !/<img\b[^>]*alt="[^"]+"/i.test(m[2]) && !/<svg[\s\S]*<title>/i.test(m[2])).length
  if (unnamed) issue("high", `${unnamed} links with no accessible name`)
  // A link to a draft renders as a link to home ("./", "../"). Resolve it and compare.
  const home = origin + "/"
  const toDraft = anchors.filter((m) => { const h = attr(m[0], "href"); if (h == null || h.startsWith("#")) return false; try { return new URL(h, url).href === home && text(m[2]) && !/home|hem|start|logo/i.test(text(m[2])) } catch { return false } }).map((m) => text(m[2]).slice(0, 40))
  if (toDraft.length) issue("med", `links that resolve to "./" (a draft target renders like this): ${[...new Set(toDraft)].slice(0, 5).join(" · ")}`)
  p.fontFaces = new Set([...html.matchAll(/font-family:\s*"([^"]+)"[^}]*?src:/g)].map((m) => m[1])).size
  p.bytes = html.length
  return p
}

async function site() {
  const s = { issues: [] }
  const robots = await get(origin + "/robots.txt")
  // Only the `User-agent: *` group counts; `Disallow: /` for GPTBot alone is a choice, not a block
  const star = (robots.text.split(/(?=^User-agent:)/im).find((g) => /^User-agent:\s*\*\s*$/im.test(g)) || "")
  s.robots = { status: robots.status, disallowAll: /^Disallow:\s*\/\s*$/im.test(star), sitemap: /sitemap/i.test(robots.text) }
  if (s.robots.disallowAll) s.issues.push({ sev: "high", msg: "robots.txt disallows everything" })
  const nf = await get(origin + "/this-page-should-404-" + Date.now())
  s.notFound = nf.status
  if (nf.status !== 404) s.issues.push({ sev: "med", msg: `unknown URL returns ${nf.status}, not 404` })
  const llms = await get(origin + "/llms.txt")
  s.llms = { status: llms.status, type: llms.headers?.get?.("content-type") }
  const u = new URL(origin)
  if (u.protocol === "https:") {
    const plain = await get("http://" + u.host + "/", { redirect: "manual", head: true })
    s.httpRedirect = plain.status
  }
  return s
}

const { urls, total, templates } = await pageList()
fs.mkdirSync(outDir, { recursive: true })
const pages = []
for (const u of urls) {
  const r = await get(u)
  pages.push(scanPage(u, r))
  process.stderr.write(`${r.status} ${u}\n`)
}
const siteInfo = await site()

// Titles/descriptions duplicated across pages
const dup = (k) => { const m = {}; for (const p of pages) if (p[k]) (m[p[k]] ||= []).push(new URL(p.url).pathname); return Object.entries(m).filter(([, v]) => v.length > 1) }
for (const [v, ps] of dup("title")) siteInfo.issues.push({ sev: "med", msg: `duplicate title on ${ps.join(", ")}: "${v.slice(0, 60)}"` })
for (const [v, ps] of dup("description")) siteInfo.issues.push({ sev: "med", msg: `duplicate description on ${ps.join(", ")}` })

// One row per unique image across the site — the image manifest seed
const imgs = new Map()
for (const p of pages) for (const i of p.images) {
  if (!i.hash) continue
  const e = imgs.get(i.hash) || { hash: i.hash, src: i.src, alts: new Set(), pages: new Set(), intrinsicW: i.intrinsicW, maxRenderPx: 0, css: !!i.css }
  if (i.alt !== null && i.alt !== undefined) e.alts.add(i.alt)
  e.pages.add(new URL(p.url).pathname)
  e.maxRenderPx = Math.max(e.maxRenderPx, i.maxRenderPx || 0)
  imgs.set(i.hash, e)
}
const images = [...imgs.values()].map((e) => ({ ...e, alts: [...e.alts], pages: [...e.pages] }))

const out = { origin, scannedAt: new Date().toISOString(), sitemapUrls: total, templates, site: siteInfo, pages, images }
fs.writeFileSync(path.join(outDir, "scan.json"), JSON.stringify(out, null, 2))

const rank = { high: 0, med: 1, low: 2, info: 3 }
const L = []
L.push(`# Site scan — ${origin}`, "", `Scanned ${out.scannedAt} · ${pages.length} of ${total} sitemap URLs (max two per CMS template) · ${images.length} unique images`, "")
L.push("## Site", "", `- robots.txt ${siteInfo.robots.status}${siteInfo.robots.sitemap ? " (lists sitemap)" : ""} · unknown URL → ${siteInfo.notFound} · llms.txt ${siteInfo.llms.status} · http → ${siteInfo.httpRedirect ?? "n/a"}`)
for (const i of siteInfo.issues) L.push(`- **${i.sev}** ${i.msg}`)
L.push("", "## Pages", "", "| Page | Title | Desc | H1 | Imgs | Schema | Issues |", "|---|---|---|---|---|---|---|")
for (const p of pages) {
  const path_ = new URL(p.url).pathname
  const sch = p.schema.length ? p.schema.map((s) => (s.ok ? [].concat(s.types).join("+") : "❌")).join(", ") : "—"
  L.push(`| ${path_} | ${p.title.length} | ${p.description?.length ?? "—"} | ${p.headings.filter((h) => h.level === 1).length} | ${p.images.length} | ${sch} | ${p.issues.filter((i) => i.sev !== "info").length} |`)
}
L.push("", "## Issues by page", "")
for (const p of pages) {
  const is = p.issues.filter((i) => i.sev !== "info").sort((a, b) => rank[a.sev] - rank[b.sev])
  if (!is.length) continue
  L.push(`### ${new URL(p.url).pathname}`, ...is.map((i) => `- **${i.sev}** ${i.msg}`), "")
}
L.push("## Images", "", "| Hash | Rendered max px | Uploaded px | Alt | Pages |", "|---|---|---|---|---|")
for (const i of images) L.push(`| \`${i.hash.slice(0, 10)}\`${i.css ? " (css)" : ""} | ${i.maxRenderPx || "?"} | ${i.intrinsicW ?? "?"} | ${i.alts.length ? i.alts.map((a) => (a ? `"${a.slice(0, 40)}"` : '""')).join(" / ") : "**missing**"} | ${i.pages.length} |`)
fs.writeFileSync(path.join(outDir, "scan.md"), L.join("\n") + "\n")
console.log(`wrote ${path.join(outDir, "scan.md")} — ${pages.reduce((n, p) => n + p.issues.filter((i) => i.sev === "high").length, 0)} high, ${images.length} images`)
