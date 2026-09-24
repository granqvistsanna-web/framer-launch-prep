#!/usr/bin/env node
// Technical accessibility of a PUBLISHED Framer site, measured in a real browser at every
// breakpoint: landmarks, heading outline, accessible names, alt, labels, ARIA misuse, focus
// traps, language. axe-core does the rule checks; colour contrast and target size are left
// to Lighthouse on purpose — this script is about STRUCTURE, what a screen reader and a
// crawler can actually read.
//
//   node a11y-structure.mjs <origin> <workDir> <label> --paths /,/about [--widths 1440,810,390]
//
// Writes <workDir>/a11y/<label>/structure.md + structure.json.
// Installs playwright-core + axe-core into <workDir>/.tools on first run and drives the
// installed Google Chrome (no browser download).
//
// Why a browser and three widths: Framer ships every breakpoint in the served HTML and
// hides all but one, and hydration can change tags. The served HTML, the API and the live
// page disagree; only the rendered page at each width is what assistive tech gets.

import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : undefined }
const [origin0, dirArg, label] = args
const origin = (origin0 || "").replace(/\/$/, "")
if (!origin.startsWith("http") || !dirArg || !label) {
  console.error("usage: node a11y-structure.mjs <origin> <workDir> <label> --paths /,/a [--widths 1440,810,390]"); process.exit(1)
}
const workDir = path.resolve(dirArg)
const paths = (flag("--paths") || "/").split(",").map((p) => p.trim())
const widths = (flag("--widths") || "1440,810,390").split(",").map(Number)
const tools = path.join(workDir, ".tools")
const req = createRequire(path.join(tools, "x.js"))
try { req.resolve("playwright-core"); req.resolve("axe-core") } catch {
  fs.mkdirSync(tools, { recursive: true })
  execSync("npm i --silent --no-audit --no-fund --prefix . playwright-core@1 axe-core@4", { cwd: tools, stdio: "inherit" })
}
const { chromium } = req("playwright-core")
const axeSource = fs.readFileSync(req.resolve("axe-core/axe.min.js"), "utf8")
const outDir = path.join(workDir, "a11y", label)
fs.mkdirSync(outDir, { recursive: true })

// Structure read from the live DOM. Visible = what this breakpoint actually renders.
function readStructure() {
  // display: contents has no box, so checkVisibility() says false — Framer wraps landmarks
  // that way. Such an element counts as visible when any child renders.
  const vis = (el) => (el.checkVisibility ? el.checkVisibility({ checkVisibilityCSS: true }) : !!el.getClientRects().length)
    || (getComputedStyle(el).display === "contents" && [...el.children].some(vis))
  const txt = (el) => (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim()
  const nameOf = (el) => {
    const l = el.getAttribute("aria-label"); if (l) return l.trim()
    const by = el.getAttribute("aria-labelledby"); if (by) return by.split(/\s+/).map((id) => txt(document.getElementById(id) || document.createElement("i"))).join(" ").trim()
    const t = txt(el); if (t) return t
    const img = el.querySelector("img[alt]:not([alt=''])"); if (img) return img.alt.trim()
    const svgTitle = el.querySelector("svg title"); if (svgTitle) return svgTitle.textContent.trim()
    return (el.getAttribute("title") || "").trim()
  }
  const LM = { banner: "header:not(main header,article header,section header,aside header,nav header),[role=banner]", navigation: "nav,[role=navigation]", main: "main,[role=main]", contentinfo: "footer:not(main footer,article footer,section footer,aside footer,nav footer),[role=contentinfo]", complementary: "aside,[role=complementary]", search: "search,[role=search]" }
  const landmarks = {}
  for (const [k, sel] of Object.entries(LM)) landmarks[k] = [...document.querySelectorAll(sel)].filter(vis).map((el) => ({ label: el.getAttribute("aria-label") || null }))
  const outside = [...document.body.querySelectorAll("a[href],button,h1,h2,h3,h4,h5,h6,p,img")].filter(vis)
    .filter((el) => !el.closest("header,nav,main,footer,aside,[role=banner],[role=navigation],[role=main],[role=contentinfo],[role=complementary],[role=dialog],[aria-hidden=true]"))
    .slice(0, 8).map((el) => `${el.tagName.toLowerCase()} "${nameOf(el).slice(0, 40)}"`)
  const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]")].filter(vis)
    .map((h) => ({ level: +(h.getAttribute("aria-level") || h.tagName.slice(1)) || 2, text: txt(h).slice(0, 70) }))
  const links = [...document.querySelectorAll("a[href]")].filter(vis).map((a) => ({ name: nameOf(a), href: a.href }))
  const GENERIC = /^(läs mer|läs mera|mer|mer info|klicka här|här|read more|learn more|more|click here|here|see more|view|details|link|länk|→|›|»)$/i
  const generic = links.filter((l) => GENERIC.test(l.name))
  const byName = {}
  for (const l of links) if (l.name) (byName[l.name.toLowerCase()] ||= new Set()).add(l.href.split("#")[0])
  const ambiguous = Object.entries(byName).filter(([, s]) => s.size > 1).map(([n, s]) => `"${n.slice(0, 40)}" → ${s.size} targets`)
  const clickDivs = [...document.querySelectorAll("div[onclick],span[onclick],[style*='cursor: pointer']:not(a):not(button)")].filter(vis)
    .filter((el) => !el.closest("a,button,[role=button],[role=link]") && !el.querySelector("a,button")).length
  const skip = [...document.querySelectorAll("a[href^='#']")].slice(0, 3).some((a) => /skip|hoppa|till innehåll|to content|main/i.test(nameOf(a)))
  const posTab = [...document.querySelectorAll("[tabindex]")].filter((el) => +el.getAttribute("tabindex") > 0).length
  return { lang: document.documentElement.lang || null, title: document.title, landmarks, outside, headings, generic: generic.map((l) => l.name), ambiguous: ambiguous.slice(0, 8), clickDivs, skip, posTab }
}

const browser = await chromium.launch({ channel: "chrome", headless: true })
const results = []
for (const p of paths) for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: w < 500 ? 3 : 1 })
  const page = await ctx.newPage()
  const r = { path: p, width: w, issues: [] }
  try {
    // networkidle never resolves on a Framer site
    await page.goto(origin + p, { waitUntil: "domcontentloaded", timeout: 60000 })
    await page.waitForTimeout(2500)
    // Scroll through once so appear effects and lazy sections mount, then back to the top
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)) } window.scrollTo(0, 0) })
    await page.waitForTimeout(800)
    Object.assign(r, await page.evaluate(readStructure))
    await page.addScriptTag({ content: axeSource })
    const axe = await page.evaluate(() => window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
      rules: { "color-contrast": { enabled: false }, "color-contrast-enhanced": { enabled: false }, "target-size": { enabled: false } },
    }))
    r.axe = axe.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, count: v.nodes.length, sample: v.nodes.slice(0, 2).map((n) => n.target.join(" ").slice(0, 90)) }))
  } catch (e) { r.error = String(e.message || e).slice(0, 200) }
  await ctx.close()

  const I = (sev, msg) => r.issues.push({ sev, msg })
  if (r.error) I("high", `page did not load: ${r.error}`)
  else {
    const L = r.landmarks
    if (L.main.length !== 1) I("high", `${L.main.length} <main> landmarks (want exactly 1)`)
    if (L.banner.length !== 1) I("med", `${L.banner.length} header/banner landmarks (want 1)`)
    if (L.contentinfo.length !== 1) I("med", `${L.contentinfo.length} footer/contentinfo landmarks (want 1)`)
    if (!L.navigation.length) I("med", "no <nav> landmark")
    if (L.navigation.length > 1 && L.navigation.some((n) => !n.label)) I("low", `${L.navigation.length} <nav>s, not all labelled (aria-label tells them apart)`)
    if (r.outside.length) I("med", `content outside every landmark: ${r.outside.slice(0, 4).join(" · ")}`)
    const h1 = r.headings.filter((h) => h.level === 1).length
    if (h1 !== 1) I("high", `${h1} visible H1s (want exactly 1)`)
    let prev = 0
    for (const h of r.headings) { if (prev && h.level > prev + 1) I("med", `heading skip h${prev}→h${h.level} at "${h.text}"`); prev = h.level }
    if (!r.lang) I("high", "no <html lang>")
    if (r.generic.length) I("med", `${r.generic.length} links named only "${[...new Set(r.generic)].slice(0, 3).join('", "')}"`)
    if (r.ambiguous.length) I("low", `same link text, different targets: ${r.ambiguous.slice(0, 3).join(" · ")}`)
    if (r.clickDivs) I("med", `${r.clickDivs} clickable elements that are not links or buttons (keyboard cannot reach them)`)
    if (r.posTab) I("med", `${r.posTab} elements with a positive tabindex (breaks tab order)`)
    if (!r.skip) I("info", "no skip-to-content link")
    for (const v of r.axe || []) I(v.impact === "critical" || v.impact === "serious" ? "high" : "med", `axe ${v.id} ×${v.count}: ${v.help} — ${v.sample.join(" | ")}`)
  }
  results.push(r)
  console.error(`${p} @${w}: ${r.issues.filter((i) => i.sev === "high").length} high, ${r.issues.filter((i) => i.sev === "med").length} med`)
}
await browser.close()

fs.writeFileSync(path.join(outDir, "structure.json"), JSON.stringify(results, null, 2))
const rank = { high: 0, med: 1, low: 2, info: 3 }
const L = [`# Accessibility structure — ${label} — ${origin}`, "", `${new Date().toISOString()} · widths ${widths.join(" / ")} · axe-core with contrast and target-size off (Lighthouse covers those)`, "",
  "| Page | Width | main | header | nav | footer | H1 | Headings | axe rules failing | High |", "|---|---|---|---|---|---|---|---|---|---|"]
for (const r of results) {
  const lm = r.landmarks || {}
  L.push(`| ${r.path} | ${r.width} | ${lm.main?.length ?? "?"} | ${lm.banner?.length ?? "?"} | ${lm.navigation?.length ?? "?"} | ${lm.contentinfo?.length ?? "?"} | ${(r.headings || []).filter((h) => h.level === 1).length} | ${(r.headings || []).length} | ${(r.axe || []).length} | ${r.issues.filter((i) => i.sev === "high").length} |`)
}
for (const p of paths) {
  L.push("", `## ${p}`)
  const rs = results.filter((r) => r.path === p)
  // An issue at every width is one issue; say which widths otherwise
  const seen = new Map()
  for (const r of rs) for (const i of r.issues) { const k = i.sev + "|" + i.msg; (seen.get(k) || seen.set(k, { ...i, widths: [] }).get(k)).widths.push(r.width) }
  const all = [...seen.values()].sort((a, b) => rank[a.sev] - rank[b.sev])
  L.push("", ...all.map((i) => `- **${i.sev}** ${i.msg}${i.widths.length === rs.length ? "" : ` _(at ${i.widths.join(", ")})_`}`))
  const outline = rs[0]?.headings || []
  if (outline.length) L.push("", `Outline at ${rs[0].width}px:`, "", "```", ...outline.slice(0, 40).map((h) => `${"  ".repeat(h.level - 1)}h${h.level} ${h.text}`), "```")
}
fs.writeFileSync(path.join(outDir, "structure.md"), L.join("\n") + "\n")
console.log(`wrote ${path.join(outDir, "structure.md")}`)
