---
name: framer-launch-prep
description: The last pass before a Framer site launches, run in gated phases with a markdown checklist you can follow. Baseline Lighthouse, then images (download every one, resize to what the site needs, convert to WebP, rename with the brand, strip ChatGPT/IMG_/Untitled names, write alt text, re-upload, verify, repoint), JSON-LD schema written to files with a click-by-click paste guide, SEO basics (titles, descriptions, H1s, slugs, noindex, OG images), technical accessibility (landmarks, heading outline, accessible names, real controls, measured in Chrome at every breakpoint), Framer-specific performance fixes, launch hygiene (redirects, domain, 404, consent, forms), and a final Lighthouse comparison. Use when the user says "framer-launch-prep", "launch prep", "pre-launch", "go-live", "before we launch", "prep the Framer site for launch", "get a good Lighthouse score on Framer", "optimise the images", "alt text before launch", or wants a Framer site made launch-ready. Resumable: it reads its own tracker and continues where it stopped. Never publishes or merges.
---

# Framer launch prep

Run at the end of a build. It takes a Framer site from "looks done" to "measures done".
Claude does the work; the site owner approves copy, pastes custom code and publishes. A
markdown tracker is where the owner follows along.

Requires the Framer agent CLI (`npx @framer/agent@latest setup`, then the `framer` skill it
installs) and Node 18+. Chrome for Lighthouse. Everything else installs on first run.

`S` below is this skill's `scripts/` folder, `R` its `reference/` folder.

---

## Ground rules

1. 🚨 **Never publish, never merge.** Every score is of the *published* site, so each
   "measure again" step is a hand-off: the owner publishes, then Claude measures.
2. **The project's own rules win.** If the project has notes (a `CLAUDE.md`, a project file),
   read them before the first write: branch rule, colour and text styles, regulated-copy
   status, live A/B tests.
3. 🚨 **Regulated sites** (health, pharma, finance, anything with legal sign-off on copy): alt
   text, titles and descriptions are **copy that can carry a claim**. Draft them, never write
   them to the canvas before the owner approves them, and describe scenes, never outcomes.
4. **Measure, don't assume.** Every tick in the tracker is a read-back or a measurement,
   never "applied cleanly".
5. **Branch.** Follow the project's rule. Where it has none, create one branch titled
   `Launch prep` from main before the first write, and say which branch you are on.
6. **Parallel sessions exist.** Re-read the tracker before every tick and change only the
   line you are ticking. If the file shrank by more than your edit, you clobbered someone
   else's ticks: restore and redo. Re-read a node before writing it.
7. **Copy style:** the site's language and voice, no trailing full stop on titles.

## Where things go

Ask once, at the start, where the tracker should live (a notes folder, an Obsidian vault,
the project repo). Default: inside the work folder.

```
~/Downloads/<Site> launch prep/              = D
  TRACKER.md                                 unless the owner named another place
  scan/baseline/  scan/final/                site-scan.mjs output
  lighthouse/baseline/  lighthouse/final/  compare-baseline-final.md
  images/original/  images/optimised/  manifest.json  review.html  alt-texts.csv
         inventory.json  uploaded.json  repoint-log.json  verify-repoint.json
  schema/  PASTE-GUIDE.md  01 … .html  _facts.md
  .tools/                                    sharp, installed on first run
/tmp/framer-launch/                          = T, exec staging (the only place exec fs reaches)
```

## What gets measured where

Lighthouse only sees a published URL, so settle this before Phase 0 and write it into the
tracker header:

- **Baseline and final run on the same origin**, or the comparison means nothing.
- **On a branch**, only a branch *preview* can be published. Measure the preview for the
  working checks. The **final** score is taken only after the owner merges and publishes.
- **Staging may be noindex.** The SEO score's `is-crawlable` fails there by design; say so
  rather than chasing it.
- **CMS content and uploads bypass the branch.** A CMS alt-text or image write is visible on
  main at once. On a live site, say so before Phase 1 touches the CMS, and do CMS rows last.

## Start, or resume

- **A tracker exists:** read it in full, find the first unticked line, and say in one line
  where you are resuming. Don't redo a ticked phase unless the site changed since (compare
  `getPublishInfo()` and the canvas against the tracker's last *Log* line). If
  `/tmp/framer-launch` is gone (a reboot), copy the Phase 1 files back from `D/images/`.
- **None:** copy `R/tracker-template.md` to the chosen place, fill the header, start Phase 0.

Then the Framer session: `npx @framer/agent@latest session new "<project url>"`, check
`(await framer.getCodeFiles()).length` is non-zero (a zero is a dead module registry: open a
new session), and `getActiveBranch()`.

## The phases

Three things need the owner's approval: the image names and alt texts (Phase 1), the
entity facts (Phase 2), the titles and descriptions (Phase 3). **Batch them.** Draft all
three before stopping so the owner approves in one sitting, and keep working on
everything that doesn't wait on them. Stop only when every open item waits on the owner,
then tick the tracker and add their items to *🙋 Your list*.

### Phase 0 · Baseline (🤖)

```bash
node $S/site-scan.mjs <origin> "$D/scan/baseline"
node $S/lighthouse.mjs <origin> "$D/lighthouse" baseline --paths /,<3–5 key pages> --runs 3 --desktop
```

- `<origin>` is the **published** URL. If the canvas is ahead of the last publish, ask for a
  publish first, or note that the baseline measures the old build.
- Key pages: home, the main conversion page, one of each CMS template, the heaviest page.
- Scores into the tracker; under *Findings* one line per issue, worst first, tagged with the
  phase that fixes it. No gate: carry on into Phase 1.

### Phase 1 · Images (🤖, one 🙋 gate)

Full method, write paths and traps in **`R/images.md`**: read it before starting.

Every raster content image is re-uploaded as **WebP**. SVG stays SVG; the favicon, touch
icon and social image stay PNG/JPG. Measured: Framer already serves WebP and a srcset, and
the public URL carries no filename, so the score wins are **alt text** and **upload
dimensions**; WebP and names are hygiene. Say so in the report; don't promise SEO from
renaming.

1. `canvas-inventory.js` (exec). Read the sample rows it prints before trusting its counts.
   `manifest.mjs build` joins it with `scan.json` on image hash → `manifest.json` +
   `alt-texts.csv`.
2. `optimise-images.mjs --download-only` → `images/original/` (the backup, never modified).
3. **Look at every original** and write `new_name` and `alt` into `alt-texts.csv`. Mark
   decorative images. `manifest.mjs review` → `images/review.html`, a contact sheet.
4. 🙋 **Gate:** the owner reads `review.html` and replies "approved" or with changes by
   number, or edits the CSV (comma or semicolon). `manifest.mjs csv-in` reads it back.
5. `optimise-images.mjs` → `images/optimised/`.
6. `upload.js` → `verify-uploads.mjs` → `repoint.js` (dry run, read every command, then
   apply) → `verify-repoint.js` in a **separate** exec. Tick only on a clean verify.
   **Before the first real batch**, run the whole chain on one frame, one instance and one
   CMS row, and read each back.
7. Rename flagged layers to the subject name.
8. What the API refused (gallery, rich-text and file fields, failed uploads) goes on the
   owner's list with the exact file and place.

### Phase 2 · Schema (🤖 writes, 🙋 pastes)

What to write: **`R/schema-templates.md`**. How to package it: **`R/schema-handoff.md`**.

- **Site-wide:** one `@graph` with `Organization` + `WebSite`, linked by `@id`, in Site
  Settings custom code. The `description` must **name the category** in the words someone
  would ask the question in, not the brand line. `sameAs` and awards: the best five to ten,
  not everything.
- **Per CMS template:** `FAQPage`, `Service`/`Product`, `Article`, `BreadcrumbList`: one
  paste per template covers every item. **Never feed a field from a CMS reference field**:
  it can ship unrendered and void the whole block.
- Collect facts from the live site. Ask the owner **once** for what is missing (legal name,
  registration number, founding year, address); leave it out until answered. A wrong
  identifier is worse than a missing one.
- Write one file per paste location, parse each, write `PASTE-GUIDE.md` and `_facts.md`.
  🙋 Owner pastes. After the next publish: `node $S/verify-schema.mjs <origin> <one path per template>`.
  Every block must parse; no `{{` may survive. The plugin API cannot read custom code back,
  so the published page is the only proof.
- Same paste: `og:locale` / `og:site_name`, and `llms.txt` via Site Settings → Files
  (`R/llms-txt.md`: the Path field is the *folder*, `/`).

### Phase 3 · SEO (🤖, one 🙋 gate)

1. Titles (≤ 60 chars, one consistent pattern such as `<Page> · <Brand>`) and descriptions
   (120–155 chars, what the page gives the reader) for every indexable page, drafted into
   the tracker table. 🙋 **Gate** on the table.
2. Write with `SET <pageId> metadata.title="…" metadata.description="…";`, read back from
   `serialize({id}).attributes.metadata`. CMS templates: bind to fields.
3. One H1 per page, no level skips, **measured in a browser at 1440 / 810 / 390**. Served
   HTML and the hydrated page can disagree.
4. Slugs ASCII, lowercase, hyphenated. A slug that is **already live** changes only with a
   redirect, and that is the owner's call.
5. noindex utility pages (thank-you, archive, test pages) with
   `SET <pageId> metadata.noIndex="true";`, read back.
6. Social image 1200×630 **JPG** on `rootNode` and key pages; favicon + touch icon (PNG).
7. Site language (it gives `<html lang>`): no confirmed API path. If the scan reports no
   `lang`, it goes on the owner's list.
8. Links to draft pages render as a link to home: `site-scan.mjs` flags them; repoint.

### Phase 4 · Accessibility: structure (🤖)

The point is that **everything on the page is exposed clearly**: to a screen reader, to a
keyboard, and to the crawlers and models that read the same accessibility tree. It is
structural and technical. Colour contrast and tap targets are *not* the focus: fix them
only where Lighthouse flags them.

```bash
node $S/a11y-structure.mjs <origin> "$D" baseline --paths <same key pages>   # 1440 / 810 / 390
```

It drives real Chrome at each breakpoint (Framer ships all three in the HTML and hides
two) and runs axe-core with contrast and target size switched off. Fix, in this order:

1. **Landmarks.** Exactly one `main`, one `header`, one `footer` per page, a `nav` at every
   breakpoint (the phone menu included), and no content outside a landmark. Fix with
   `SET <frameId> htmlTag="main";` (also `header`, `nav`, `footer`, `section`, `article`,
   `aside`) on the page frame or layout template. `htmlTag` mirrors to breakpoint replicas;
   read each back anyway. Two `nav`s get an `ariaLabel` each ("Main", "Footer").
2. **Headings.** One H1 per page at every width, no level skips, and no heading used for
   size alone. Fix the text node's `tag`; keep its text style. Variable-bound text may drop
   a per-node tag at hydration: clone the text style, change only its tag, and bind that.
3. **Names.** Every link and button has a name that makes sense read out of context:
   icon-only links (social, arrows, burger) get `ariaLabel`; "Read more" / "Läs mer"
   repeated to different targets gets rewritten to name its target (copy: the Phase 3 gate).
   Decorative images are `alt=""`, informative ones are described (Phase 1).
4. **Real controls.** Anything clickable is a link or a button, reachable by Tab, with
   visible focus. Divs with a click handler, a burger that is a checkbox in a label,
   accordions without `aria-expanded`: fix in the component, or flag a code component to
   its owner. No positive `tabindex`.
5. **Forms and embeds.** Every input has a label (a placeholder is not one); every iframe
   has a `title`.
6. **Language.** `<html lang>` set; parts in another language marked.

Re-run the script after fixes (label `after`). Tick when every page is clean at all three
widths, or each remaining item is explained. Lighthouse accessibility at 100 then follows,
and it is a check, not the goal.

### Phase 5 · Performance (🤖, 🙋 on third-party scripts)

Fix only what the baseline names, via **`R/lighthouse-levers.md`**. Usually, by payoff:

1. **An appear effect on the LCP element or an ancestor**, if it starts at opacity 0.
   Confirm with the *LCP phases* line in `summary.md`: a large render delay on an element
   that loaded early. Remove it there and re-measure.
2. Hero upload size (Phase 1; confirm the LCP element is the new asset).
3. Third-party scripts in custom code: `defer`/`async`, or end of `<body>`. Claude writes the
   replacement snippet; the owner pastes it and decides what stays.
4. Embeds behind a facade, video compressed with a poster, unused font weights unbound,
   heavy code components only where used, fixed aspect ratios against CLS.

### Launch hygiene (🤖 checks, 🙋 decides)

- **Redirects** for every old URL that stops resolving (domain cutover, rebuild of an older
  site). The old sitemap or Search Console is the list.
- **Domain:** www vs apex resolves to one; canonical = production; http → https.
- **404 page** exists and returns 404.
- **Cookie consent** where the audience needs it, as an overlay (not a layout shift).
- **Forms:** one test submission. 🙋 Ask first: it sends a real message.
- **Analytics** on production; **Search Console** verified, sitemap submitted (🙋).
- **Localization:** every page in every locale; `hreflang` resolves.

### Phase 6 · Final (🙋 publishes, 🤖 measures)

```bash
node $S/site-scan.mjs <origin> "$D/scan/final"
node $S/lighthouse.mjs <origin> "$D/lighthouse" final --paths <same as baseline> --runs 3 --desktop
node $S/lighthouse.mjs - "$D/lighthouse" - --compare baseline,final
node $S/verify-schema.mjs <origin> <one path per template>
```

⚠️ Merged is not published, and a publish in flight can serve the old build on a 200. Check
the deployment time against the clock before measuring.

Write `REPORT.md` next to the tracker: scores before → after, what changed per phase, what
is left under *Open* and whose call it is. Fill the tracker's final scores row.

---

## Replies

At each gate: the result first, short. Then one line of what was done and **one** next
action for the owner, the top of their list. Long tables go in the tracker, not the chat.

## Quality bar

- Every image has a deliberate alt: descriptive, or empty because decorative
- Every raster content upload is WebP; SVG stays SVG; icons and social image PNG/JPG
- No upload wider than ~2560 px or ~2× its largest rendered width; every replacement is
  pixel-verified against the local file before anything points at it
- No layer or asset named after a tool, a camera or a default
- Every JSON-LD block on the live site parses; no `{{` survives
- One H1 per page at every breakpoint; every indexable page has its own title and description
- One `main`, one `header`, one `footer` and a `nav` on every page at every breakpoint; every
  link, button, image, input and iframe named; no content outside a landmark
- Accessibility, Best Practices and SEO at 100 on every key page
- Performance: every audit the baseline named is fixed or explained. Framer ships its own
  runtime, so there is no fixed Performance number
- Every tick in the tracker was read back or measured

## Common mistakes

- Converting to WebP without resizing and calling the images optimised
- Writing alt text from the layer name instead of looking at the picture
- Trusting "Commands applied cleanly", or a screenshot, for an image swap
- Reporting a Lighthouse score measured on anything but the published site
- Chasing mobile Performance 100 instead of the audits Lighthouse actually names
- Rewriting the tracker instead of editing one line
