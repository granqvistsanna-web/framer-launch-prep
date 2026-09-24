# {{DATE}} QA — launch prep

**Project:** {{PROJECT}} (`{{PROJECT_ID}}`) · **Published URL measured:** {{ORIGIN}}
**Branch:** {{BRANCH}} · **Working files:** `~/Downloads/{{PROJECT}} launch prep/`
**Started:** {{DATE}} · **Skill:** `framer-launch-prep`

Nothing on this list is published or merged by Claude. Every measured score below is of
the **published** site, so a fix only shows up after you publish.

## 🙋 Your list

The things only you can do, in the order they unblock work. Claude adds to this list as
the phases run; tick them here.

- [ ] Publish (staging is fine) so the baseline measures the current build — *Phase 0*
- [ ] Approve in one sitting: image names + alt texts (`images/review.html`), entity facts
      (Phase 2), titles + descriptions (table below)
- [ ] Paste the schema snippets, one per file, following `schema/PASTE-GUIDE.md` — *Phase 2*
- [ ] Publish again so the final Lighthouse run can measure the fixes — *Phase 6*

## Scores

Lighthouse 12, median of 3 runs on the pages that matter. Measured on: {{MEASURED_ORIGIN}}
(baseline and final on the same origin).

| Page | Form | Perf | A11y | BP | SEO | LCP s | CLS | When |
|---|---|---|---|---|---|---|---|---|
| | mobile | | | | | | | baseline |
| | desktop | | | | | | | baseline |
| | mobile | | | | | | | final |
| | desktop | | | | | | | final |

Target: **Accessibility, Best Practices and SEO at 100 on every page.** Performance: every
audit the baseline names gets fixed or explained. A Framer site ships its own runtime, so
there is no fixed Performance number to hit.

## Status key

`[ ]` not started · `[~]` in progress · `[x]` done and **read back** · `[-]` won't do (reason on the line) · 🤖 Claude · 🙋 you

---

## Phase 0 · Baseline

- [ ] 🤖 Session open, healthy, branch confirmed
- [ ] 🤖 Downloads work folder created
- [ ] 🤖 Site scan → `scan/baseline/scan.md`
- [ ] 🤖 Lighthouse baseline, key pages mobile + desktop → `lighthouse/baseline/summary.md`
- [ ] 🤖 Top findings written under *Findings* below, each tagged with the phase that fixes it

## Phase 1 · Images

- [ ] 🤖 Canvas inventory (frames, instances, CMS, metadata) joined to the published inventory
- [ ] 🤖 Originals downloaded → `images/original/` (the backup)
- [ ] 🤖 New names + alt texts drafted → `images/alt-texts.csv` + `images/review.html`
- [ ] 🙋 **Gate:** names and alt texts approved
- [ ] 🤖 Optimised → `images/optimised/` (sizes and savings in the manifest)
- [ ] 🤖 Uploaded, every asset verified pixel-for-pixel against the local file
- [ ] 🤖 Chain proven on one frame, one instance, one CMS row
- [ ] 🤖 Every usage repointed, alt written → `verify-repoint.js` clean
- [ ] 🤖 Decorative `alt=""` confirmed in the published HTML (after Phase 6 publish)
- [ ] 🤖 Layer names cleaned (no ChatGPT / IMG_ / Untitled / hashes)
- [ ] 🙋 Drag-and-drop list (uploads the API refused), if any

## Phase 2 · Schema

- [ ] 🤖 Entity facts collected from the site and the project notes
- [ ] 🙋 Missing facts answered: {{MISSING_FACTS}}
- [ ] 🤖 Snippets written → `schema/`, each file parsed as JSON before it is handed over
- [ ] 🙋 Snippets pasted (one tick per file in `schema/PASTE-GUIDE.md`)
- [ ] 🤖 After publish: every block parsed on the live site, no `{{` survives

## Phase 3 · SEO

- [ ] 🤖 Titles + descriptions drafted for every indexable page → table below
- [ ] 🙋 **Gate:** titles and descriptions approved
- [ ] 🤖 Written to page settings and read back
- [ ] 🤖 One H1 per page, no heading skips — measured in a browser at 1440 / 810 / 390
- [ ] 🤖 Slugs ASCII, lowercase, hyphenated; redirects listed for any live slug that changes
- [ ] 🤖 Utility pages noindex (thank-you, archive, old/*, test pages)
- [ ] 🤖 Social image 1200×630 site-wide, per key page where it earns it
- [ ] 🤖 Favicon + touch icon set; site language set
- [ ] 🤖 No live link points at a draft (renders as `href="./"`)
- [ ] 🙋 Sitemap submitted in Search Console after launch

## Phase 4 · Accessibility

- [ ] 🤖 Contrast of every text-colour / surface pair in use, measured against the tokens
- [ ] 🤖 Every link and button has a name that makes sense out of context
- [ ] 🤖 Tap targets ≥ 24×24 px (WCAG 2.2), nav and footer links included
- [ ] 🤖 Focus is visible on every interactive element
- [ ] 🤖 Form fields have labels; errors are announced
- [ ] 🤖 Motion: nothing essential depends on an animation; no autoplaying sound
- [ ] 🤖 Lighthouse accessibility 100 on every key page

## Phase 5 · Performance

- [ ] 🤖 LCP element identified per key page; no appear effect on it or its ancestors
- [ ] 🤖 Hero image ≤ 2560 px and not lazy
- [ ] 🤖 Custom code: every third-party script async/defer or moved to end of `<body>`
- [ ] 🤖 Embeds (YouTube, Vimeo, maps, chat) behind a facade or lazy
- [ ] 🤖 Video: compressed, poster set, no multi-MB autoplay on mobile
- [ ] 🤖 Fonts: only the families and weights actually used
- [ ] 🤖 Heavy code components (three, lottie, gsap) only on the pages that use them
- [ ] 🤖 CLS: embeds and media have fixed aspect ratios
- [ ] 🙋 Script decisions (drop / delay / keep) for anything marketing owns

## Launch hygiene

- [ ] 🤖 Redirect list for every old URL that stops resolving; 🙋 applied
- [ ] 🤖 www/apex → one domain, canonical = production, http → https
- [ ] 🤖 404 page exists and returns 404
- [ ] 🤖 Cookie consent in place where needed, as an overlay
- [ ] 🙋 One test form submission (sends a real message; your call)
- [ ] 🤖 Analytics fires on production; 🙋 Search Console verified
- [ ] 🤖 Locales and hreflang complete (if localized)

## Phase 6 · Final

- [ ] 🙋 Published
- [ ] 🤖 Site scan + Lighthouse final, compared with baseline → `lighthouse/compare-baseline-final.md`
- [ ] 🤖 Schema verified on the live site
- [ ] 🤖 What is left, and why, written under *Open* below

---

## Findings

<!-- Phase 0 writes here: one line per finding, tagged [P1]…[P5], worst first -->

## Titles and descriptions

| Page | Title (≤ 60) | Chars | Description (120–155) | Chars | Status |
|---|---|---|---|---|---|

## Open

<!-- What did not get fixed, why, and whose call it is -->

## Log

<!-- Append only. One line per session: date, what moved, where it stopped -->
