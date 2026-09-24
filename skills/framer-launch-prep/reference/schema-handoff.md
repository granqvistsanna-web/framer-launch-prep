# Schema — writing the files, and handing them over

What to write is in `schema-templates.md` next to this file. This file covers how the
output is packaged so the site owner can paste it without reading JSON.

## Why this is a hand-off

The plugin API cannot read user-authored custom code (`getCustomCode()` returns `null` for
all four locations while the published head contains them), so an API write could not be
read back, would land in a separate plugin slot that does not show in Site Settings, and
could not be edited there. Snippets the owner pastes are visible, editable, and sit where the
next person will look. Claude writes and validates the files; the owner pastes; Claude
verifies on the published site.

## Folder

```
~/Downloads/<Project> launch prep/schema/
  PASTE-GUIDE.md
  01 site-wide · end of head · Organization + WebSite.html
  02 page · faq · end of head · FAQPage.html
  03 cms template · blog-:Blog · end of head · Article + BreadcrumbList.html
  …
  _facts.md              the entity facts used, and where each came from
```

- **One file per paste location.** The file name says where it goes, so the file tells
  the owner what to do with it before she opens it.
- Each file is the exact text to paste, `<script type="application/ld+json">` tags
  included, and nothing else. No comments inside the script: a stray `//` breaks JSON.
- **CMS variables are typed text, unquoted:** `"name": {{question}},` exactly as
  `schema-templates.md` writes them, using this project's real field names or ids. Framer
  renders them as JSON strings. Never wrap them in quotes, and never feed one from a CMS
  **reference** field: that is the expression that shipped unrendered and voided the block.
- **Before handing over:** strip the tags and `JSON.parse` every file. For CMS templates,
  swap each `{{…}}` for `"x"` (a quoted dummy) first, then parse. A file that does not
  parse is not handed over.

## PASTE-GUIDE.md

Write it for someone who has never opened the custom-code panel. Fill in from the real
project. The click paths below are **unverified**: on the first run in any project,
screenshot the real panel (`readProject([{type:"screenshot",…}])` cannot reach Settings, so
ask the owner for one if unsure), correct the guide, and note the confirmed path in the
project's notes.

```markdown
# Schema — paste guide

Every file in this folder is pasted once, in the place its name says. Tick each one.

## Site-wide (one paste covers every page)

- [ ] `01 site-wide · end of head · …html`
  1. Open the project → **Site Settings** (gear, top left) → **General**, scroll to **Custom Code**
     (on some versions: Site Settings → **Code**)
  2. Find **End of `<head>` tag**
  3. Paste the whole file below anything already there. Don't delete existing code
  4. Save

## One page

- [ ] `02 page · faq · end of head · …html`
  1. In the Pages panel, hover **FAQ** → click the **⚙** (page settings)
  2. Scroll to **Custom Code** → **End of `<head>` tag**
  3. Paste, save

## CMS template (one paste covers every item)

- [ ] `03 cms template · blog-:Blog · …html`
  1. Pages panel → the template page (**Blog › :Blog**, the one with the CMS icon) → **⚙**
  2. **Custom Code** → **End of `<head>` tag** → paste
  3. Leave every `{{…}}` exactly as it is. Those are Framer's CMS fields and they fill in
     per item when the site is published. Don't add quotes around them
  4. Save

## After pasting

Tell Claude "schema pasted". Nothing goes live until you publish; after that Claude
fetches every page type and parses each block.
```

## Facts

`_facts.md` lists every value in the snippets with its source: *site footer*, *about page*,
*project notes*, *owner, <date>*. A fact with no source is not in a snippet. Missing
registration number, founding year or legal name: ask once, in the tracker's Phase 2
line, and leave the field out until the answer arrives.

## Verify, after the owner publishes

```bash
node <skill>/scripts/verify-schema.mjs <origin> / /faq /blog/<one-slug> …
```

One URL per template. Every block must parse, no `{{` may survive. Tick Phase 2 only then.
