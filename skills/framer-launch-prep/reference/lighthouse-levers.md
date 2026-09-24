# Lighthouse on Framer — what moves, what doesn't

Read `lighthouse/<label>/summary.md` first; each failing audit there carries its id. Find the
id below. **Fix only what the report names.** A lever the report does not flag is not work.

## Set expectations first

Framer ships its own runtime, so `unused-javascript`, `bootup-time` and
`mainthread-work-breakdown` always show some cost that no site setting removes. Measured
2026-09-24 on a live Framer homepage: 278 KiB unused JS, 3.2 s main-thread work, mobile
Performance 67. Everything below is the part that **is** in our hands.

- Accessibility, Best Practices, SEO: **100 is reachable on every page.** Anything less is a
  specific fixable audit.
- Performance: **no fixed number.** Fix or explain every audit the baseline names, and report
  the score per page. Pages heavy with video, 3D or embeds land lower; say which and why.
- Run 3 times and keep the median (`--runs 3`). One run swings ±10.

## Performance

| Audit id | Usual Framer cause | Fix | Who |
|---|---|---|---|
| `largest-contentful-paint`, `largest-contentful-paint-element` | Hero image uploaded at 3000–6000 px (measured). Plausibly also an **appear effect on the hero, its headline, or an ancestor** starting at `opacity: 0` | Resize the upload (Phase 1). For the appear effect, confirm first: a large *render delay* in the LCP breakdown. Then remove it from the LCP element and its ancestors, and re-measure | 🤖 |
| `lcp-discovery-insight` (fetchpriority missing) | No per-image `fetchpriority` control found in Framer so far (unverified; `site-scan.mjs` records the attribute, so check what the page actually ships) | Make the file small, and keep the hero an image fill, not a code component or CSS background | — |
| `lcp-lazy-loaded` | Hero image inside a component Framer lazy-loads | Put the hero image directly in the page section, not deep inside a nested instance | 🤖 |
| `image-delivery-insight`, `uses-responsive-images` | Uploaded far wider than drawn | Phase 1 resize | 🤖 |
| `offscreen-images` | Carousel / ticker images below the fold | Usually minor; fewer duplicated ticker items | 🤖 |
| `render-blocking-resources`, `render-blocking-insight` | A `<script src>` in custom code **Start/End of head** without `async`/`defer` | Add `defer` (or `async` for analytics), or move to **End of `<body>`** | 🤖 writes the new snippet, 🙋 pastes |
| `third-party-facades` | YouTube / Vimeo iframe, Intercom / HubSpot chat, Calendly | Thumbnail + click-to-load (a native frame with the poster image and a link, or the embed on a second page). Chat: load on interaction | 🤖 builds, 🙋 decides what marketing can lose |
| `third-party-summary`, `unused-javascript` (non-Framer hosts) | GTM with many tags, several pixels, Hotjar | List every host with its KB; the owner decides what stays | 🙋 |
| `font-display`, font requests | Many families/weights, some unused | Each weight is one file. Unbind unused weights; a font never bound is not loaded | 🤖 |
| `total-byte-weight` | Background video, Lottie JSON, big GIFs | Video: H.264 MP4 ≤ 2–4 MB, 720p, poster set, muted; GIF → video. Lottie: check the JSON size | 🤖 flags, 🙋 re-exports |
| `bootup-time` on a code component | three.js / gsap / lottie in a code component on every page | Keep it only on pages that use it; lazy-mount below the fold | 🤖 |
| `cumulative-layout-shift` | Embeds and code components without fixed height; a cookie banner that pushes content; web-font swap on huge headings | Fixed aspect ratio or height on embeds; banner as an overlay (`position: fixed`); stable line-height | 🤖 |
| `bf-cache` | A third-party script with an `unload` handler | Identify the script from the report; usually a vendor setting | 🙋 |

## Accessibility

| Audit id | Usual Framer cause | Fix |
|---|---|---|
| `color-contrast` | Muted text token on a tinted surface; text on an image; placeholder text | Measure the token pair; change the token binding, never the hex. If no token passes, say so and ask before adding one |
| `link-text` | "Learn more", "Read more", "Läs mer" repeated | Rewrite the visible text so it names the target ("Read the pricing guide"). Copy change: regulated sites go through the owner's sign-off |
| `link-name`, `button-name` | Icon-only link or button (social icons, arrows, burger) | Give the frame an accessible label / visible text; social icons: the network name |
| `image-alt` | Missing alt | Phase 1 |
| `heading-order` | h2 → h4 for visual size | Fix the tag, keep the style (if the text is variable-bound, a per-node tag may not survive hydration: clone the text style, change only its tag, and bind that) |
| `target-size` | Footer links, inline icons < 24 px | Padding on the link frame, not a bigger font |
| `html-has-lang` | Site language never set | Site Settings → language (or the default locale) |
| `label` | Form input without a label | Visible label; placeholder is not a label |
| `aria-*`, `duplicate-id-aria` | Usually a code component | Fix in the component |

Lighthouse checks about 30% of WCAG. After it reads 100, still check by hand: keyboard
tab order through nav and forms, visible focus, menus closing on Escape, nothing that
only works on hover, reduced motion respected by code components.

## Best practices

| Audit id | Cause | Fix |
|---|---|---|
| `errors-in-console` | A code component or third-party script throwing | Read the error; fix or remove the source |
| `inspector-issues` | Third-party cookies, mixed content | Vendor settings; `https` everywhere in custom code |
| `image-aspect-ratio`, `image-size-responsive` | Image drawn at a different ratio than uploaded with `fit` off | Crop the upload to the frame's ratio |
| `deprecations` | Old embed code | Update the snippet |

## SEO

| Audit id | Cause | Fix |
|---|---|---|
| `meta-description` | Empty, or "Made with Framer" | Phase 3 |
| `document-title` | "My Framer Site" | Phase 3 |
| `link-text` | Generic link text (also an a11y fail) | See above |
| `is-crawlable` | Page left on noindex, or robots.txt blocks | Check the page's search-engine toggle; staging may be noindex on purpose (note below) |
| `canonical` | Missing or pointing at the staging domain | Site Settings → the primary domain |
| `crawlable-anchors` | `href="./"` from a link to a draft, `javascript:` links in code components | Repoint to a live page |
| `hreflang` | Localized site with a missing locale | Localization settings |

⚠️ **Staging can be noindex on purpose.** If `site-scan.mjs` reports the page as noindex on a
staging domain, `is-crawlable` fails there by design. Read SEO off the production domain, or
discount that one audit on staging and say so.
