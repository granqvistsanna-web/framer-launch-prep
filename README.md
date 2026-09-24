# framer-launch-prep

A Claude Code skill for the last pass before a Framer site goes live. It measures the
published site, fixes what can be fixed through the Framer agent, hands you the parts
only you can do (pasting custom code, publishing), and measures again.

Claude works in phases and keeps a markdown tracker you can follow as it goes.
It never publishes and never merges.

## Install

```
/plugin marketplace add granqvistsanna-web/framer-launch-prep
/plugin install framer-launch-prep@framer-launch-prep
```

Then, in a session: `/framer-launch-prep` or "launch prep for <project url>".

## What it does

| Phase | Claude | You |
|---|---|---|
| 0 · Baseline | Site scan + Lighthouse (mobile and desktop, median of 3) on the published site | Publish, if the canvas is ahead |
| 1 · Images | Downloads every image, writes names and alt text from looking at each picture, resizes to what the site draws, converts to WebP, re-uploads, verifies each upload pixel by pixel, repoints every usage | Approve names and alt texts on a contact sheet |
| 2 · Schema | Organization, WebSite, FAQPage, Article… one file per paste location, each parsed, plus a click-by-click paste guide | Paste, then publish |
| 3 · SEO | Titles, descriptions, one H1 per page, slugs, noindex, social image, favicon | Approve titles and descriptions |
| 4 · Accessibility | Structure at every breakpoint: landmarks, headings, names for every link, button, image, input and iframe, real controls, language (axe-core in Chrome) | — |
| 5 · Performance | Fixes what Lighthouse names: LCP, render-blocking scripts, embeds, fonts, CLS | Decide which third-party scripts stay |
| Launch hygiene | Redirects, domain, 404, consent, analytics, locales | Test form, Search Console |
| 6 · Final | Scan + Lighthouse again, before → after table, report | Publish |

Your three approvals are batched into one sitting.

## What it found out about Framer, so you don't have to

- **Framer already serves WebP and a responsive srcset.** Converting alone does nothing for
  the score. What matters is the size of the upload: the largest srcset candidate *is* the
  uploaded file, so a 3,600 px hero on a phone downloads all 3,600 px. The skill converts to
  WebP anyway, and resizes, which is the part that moves the score.
- **Image URLs are hashes.** Renaming files cleans up the asset library and your backup
  folder; it is not an SEO lever on Framer. Alt text is.
- **A re-hosted image can come back as a different picture** with your alt text still on it.
  Every upload is compared against the local file before anything points at it.
- **Mobile Performance 100 is rarely reachable on Framer** (its runtime ships on every page).
  The target is 100 for Accessibility, Best Practices and SEO, and every audit Lighthouse
  names fixed or explained.

## Requirements

- [Claude Code](https://claude.com/claude-code)
- The Framer agent CLI: `npx @framer/agent@latest setup`, with the project open in Framer
- Node 18+ and Google Chrome (for Lighthouse). `sharp` installs itself into the work folder

## Where files go

`~/Downloads/<Site> launch prep/`: originals (your backup), optimised images, the image
contact sheet, schema files and paste guide, scans, Lighthouse reports, the tracker (or a
notes folder you name).

## Status

0.1. The local scripts (scan, Lighthouse, optimise, manifest, verify) are tested against a
live Framer site. The canvas write steps are guarded by dry runs and read-backs, and the
skill proves the chain on one image of each kind before doing the rest. Issues welcome.

Made by [Sanna Granqvist](https://granqvistsanna-web.github.io/). Also: the
[image converter](https://granqvistsanna-web.github.io/image-compressor/) this skill matches.
