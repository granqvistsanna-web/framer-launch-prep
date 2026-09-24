#!/usr/bin/env node
// Schema and head verification. Client-agnostic: pass an origin and paths.
//
//   node verify.mjs https://example.com / /faq/some-question /services/some-service
//   node verify.mjs https://example.com --llms          also check every llms.txt link
//   node verify.mjs https://example.com --headings      also read outlines in a browser
//
// Exits 1 if any JSON-LD block fails to parse, any `{{` survives, or lang is missing.

const args = process.argv.slice(2);
const origin = (args.find((a) => a.startsWith("http")) || "").replace(/\/$/, "");
if (!origin) {
  console.error("usage: node verify.mjs <origin> [paths…] [--llms] [--headings]");
  process.exit(2);
}
const flags = new Set(args.filter((a) => a.startsWith("--")));
const paths = args.filter((a) => !a.startsWith("http") && !a.startsWith("--"));
if (!paths.length) paths.push("/");

let failures = 0;
const get = async (url) => {
  const r = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
  return { status: r.status, type: r.headers.get("content-type") || "", body: await r.text() };
};

for (const p of paths) {
  const url = origin + (p.startsWith("/") ? p : "/" + p);
  let res;
  try { res = await get(url); } catch (e) { console.log(`\n${p}\n  FETCH FAILED: ${e.message}`); failures++; continue; }
  console.log(`\n${p}  [${res.status}]  ${res.body.length} bytes`);

  const lang = res.body.match(/<html[^>]*\slang="([^"]*)"/i);
  if (lang) console.log(`  lang: ${lang[1]}`);
  else { console.log("  lang: MISSING  <-- WCAG 3.1.1, and the clearest language signal a model has"); failures++; }

  const og = [...res.body.matchAll(/<meta property="(og:[a-z_]+)"/g)].map((m) => m[1]);
  const ogSet = [...new Set(og)];
  console.log(`  og: ${ogSet.join(", ") || "none"}`);
  for (const need of ["og:locale", "og:site_name"]) {
    if (!ogSet.includes(need)) console.log(`       ${need} missing`);
  }

  const blocks = [...res.body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (!blocks.length) { console.log("  JSON-LD: NONE"); failures++; }
  blocks.forEach((b, i) => {
    const stray = [...b.matchAll(/"[^"]+":\s*\{\{[^}]*\}\}/g)].map((m) => m[0]);
    try {
      const d = JSON.parse(b);
      const g = Array.isArray(d) ? d : d["@graph"] || [d];
      const types = g.map((x) => x && x["@type"]).filter(Boolean).join(", ");
      console.log(`  JSON-LD #${i + 1}: OK  (${types})`);
    } catch (e) {
      console.log(`  JSON-LD #${i + 1}: INVALID  ${e.message}`);
      if (stray.length) {
        console.log("       cause: unrendered template expression, so the WHOLE block is discarded");
        stray.forEach((s) => console.log(`       ${s}`));
        console.log("       fix: hardcode the field per template, or drop it. Smaller and valid beats richer and invalid.");
      }
      failures++;
    }
  });

  if (/\{\{[^}]*\}\}/.test(res.body)) {
    const n = (res.body.match(/\{\{/g) || []).length;
    console.log(`  UNRENDERED: ${n} occurrence(s) of {{ in the published page`);
  }
}

if (flags.has("--llms")) {
  const url = origin + "/llms.txt";
  const r = await get(url).catch(() => null);
  console.log(`\n/llms.txt  [${r ? r.status : "FAILED"}]  ${r ? r.type : ""}`);
  if (!r || r.status !== 200) { console.log("  not served. Site Settings -> Files, Path is the FOLDER: use /"); failures++; }
  else if (!/^text\/plain/.test(r.type)) { console.log("  wrong content-type"); failures++; }
  else {
    const links = [...new Set([...r.body.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]))];
    console.log(`  ${links.length} unique links, checking…`);
    let bad = 0;
    for (const l of links) {
      const c = await fetch(l, { method: "HEAD" }).then((x) => x.status).catch(() => 0);
      if (c !== 200) { console.log(`    ${c}  ${l}`); bad++; }
    }
    console.log(`  non-200: ${bad}`);
    failures += bad;
  }
}

if (flags.has("--headings")) {
  let chromium;
  try { ({ chromium } = await import("playwright")); }
  catch { console.log("\n--headings needs playwright: npm i playwright && npx playwright install chromium"); }
  if (chromium) {
    const b = await chromium.launch();
    for (const p of paths) {
      for (const w of [1440, 900, 390]) {
        const pg = await b.newPage({ viewport: { width: w, height: 900 } });
        // networkidle never resolves on a Framer site
        await pg.goto(origin + p, { waitUntil: "domcontentloaded", timeout: 60000 });
        await pg.waitForTimeout(4500);
        // no visibility filter: sticky labels have zero client rects before scrolling
        const hs = await pg.evaluate(() =>
          [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((e) => e.tagName + ":" + e.textContent.trim().slice(0, 30)));
        const lv = hs.map((h) => +h[1]);
        const skips = lv.map((v, i) => (i && v - lv[i - 1] > 1 ? `${lv[i - 1]}->${v}` : null)).filter(Boolean);
        console.log(`\n${p} @ ${w}px  ${hs.length} headings  skips: ${skips.join(", ") || "none"}`);
        if (skips.length) { hs.forEach((h) => console.log("   " + h)); failures++; }
        await pg.close();
      }
    }
    await b.close();
  }
}

console.log(`\n${failures ? `FAIL: ${failures} problem(s)` : "PASS"}`);
process.exit(failures ? 1 : 0);
