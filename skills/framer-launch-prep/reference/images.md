# Images — naming, alt text, and the round trip

## What actually moves the score

Measured on a live Framer site, 2026-09-24:

- Framer **already serves WebP** to any browser that asks (`Accept: image/webp` → `content-type: image/webp`)
  and Lighthouse's `modern-image-formats` passes untouched. **We upload WebP anyway (house
  rule):** every raster content image leaves the pipeline as `.webp`, so the asset library,
  the backup folder and anything fetched outside a browser are WebP too. **Exceptions:** SVG
  stays SVG, and the favicon, touch icon and social image stay PNG/JPG (iOS and social
  scrapers need them). `manifest.mjs` marks those `keep`.
- Framer **already builds a srcset**: `?scale-down-to=512`, `?scale-down-to=1024`, then the
  **uploaded file itself** as the top candidate. A 3593 px hero drawn at 412 px on a 2.6× phone
  needs 1071 px, overshoots the 1024 w candidate, and downloads all 3593 px. That was the LCP
  element, at 7.9 s.
- The public URL is `framerusercontent.com/images/<hash>.<ext>`: **no filename in it.**
  Renaming does nothing for image SEO on Framer. It does give a clean asset library, clean
  layer names, and a backup folder a person can use. Do it for that, and say so.

So the order of value for the score is: **(1) alt text, (2) upload dimensions, (3) names.**
WebP is the house format on top of that. Don't report it as the thing that moved Lighthouse.

### Manual converter

<https://granqvistsanna-web.github.io/image-compressor/>: drag in, WebP out at quality 82,
batch as a zip. It keeps the original pixel size, so it is the **manual route** for a
one-off or for the drag-and-drop list, **after** resizing. The pipeline uses
`optimise-images.mjs`, which encodes at the same quality 82 and also resizes. Point the
owner at the converter whenever an image has to go in by hand.

## Naming

`<brand>-<subject>-<qualifier>`, lowercase ASCII, hyphens only, ≤ 60 characters.

- `<brand>` is the brand's short slug, not the legal name: `acme`, `northwind`.
  Same slug on every file.
- `<subject>` is what is in the picture, not where it sits: `coach-reviewing-plan`, not
  `hero-image` or `section-3`.
- `<qualifier>` only to disambiguate: `-portrait`, `-wide`, `-01`.
- Transliterate: å ä → a, ö → o, é → e. No spaces, no uppercase, no dates.
- Never carry any of: `chatgpt`, `dall-e`, `midjourney`, `firefly`, `gemini`, `copilot`,
  `generated`, `screenshot`, `untitled`, `img_1234`, `dsc_…`, `final`, `copy`, `kopia`,
  `(1)`, a 16+ char hash. `canvas-inventory.js` flags these on layer names.
- The **layer** is renamed too, to the same subject words:
  `Coach reviewing plan`. Framer named it after the dropped file.

## Alt text

Written in the site's language. One sentence, **≤ 125 characters**, no full stop needed.

1. **Say what is there, for the reason it is there.** "Coach and client reviewing a
   training plan on a tablet", not "Fitness".
2. **Never** "image of", "picture of", "bild på". The screen reader already said image.
3. **Decorative → empty alt (`""`)**: background textures, dividers, blurred gradients,
   an image that repeats the adjacent heading. Mark `decorative: true` in the manifest.
4. **Logos:** the brand name alone ("Acme"). Client-logo strips: each company's name.
5. **Text inside the image:** the text, verbatim.
6. **Don't restate the caption or the heading next to it.** If they say it all, go decorative.
7. **Never guess** identity, ethnicity, age, health or disability. Describe what is
   visible and relevant, nothing more.
8. 🚨 **Regulated sites** (health, pharma, finance, anything with legal sign-off on copy):
   alt text is copy, and it can carry a claim. "Woman after losing weight" is an outcome
   claim. Describe the scene only, and every alt goes through the Phase 1 gate.
9. **Keyword stuffing fails the review.** The brand name belongs in the file name, not in
   every alt.

Look at every image before writing its alt: read the file from `images/original/`. Never
write alt from the filename, the layer name or the section it sits in.

## The approval sheet

`images/alt-texts.csv`, one row per unique image:

```
hash,preview,current_layer_name,bad_name,new_name,alt,decorative,usages,pages,uploaded_px,max_render_px,current_alt,notes
```

The owner does not review a CSV: they review **`images/review.html`**, one card per image with the
picture, the new name and the alt, numbered. They reply "approved" or give changes by
number, and Claude writes them into the CSV. They may also edit the CSV herself: comma or
semicolon (Swedish Excel/Numbers), with or without BOM. A wrong-encoding save is refused
rather than read as garbage. `csv-in` adds the brand prefix if a typed name lacks it, and
refuses to write anything while two rows share a name.

## The round trip

`D` is the Downloads work folder, everywhere in this skill.

```bash
D="$HOME/Downloads/<Project> launch prep"
S=<this skill>/scripts
T=/tmp/framer-launch                     # the only place exec fs can reach; wiped on reboot
mkdir -p "$D/images" "$T/optimised"

# 1 · inventory both sides
node $S/site-scan.mjs <origin> "$D/scan/baseline"
npx @framer/agent@latest exec -s <id> < $S/canvas-inventory.js     # read the sample rows it prints
cp $T/inventory.json "$D/images/"

# 2 · join on hash → manifest.json + the approval sheet
node $S/manifest.mjs build "$D" <brandSlug>
node $S/optimise-images.mjs "$D" --download-only   # originals → images/original/ (the backup)
#     LOOK at each original, write new_name + alt (or decorative) into alt-texts.csv
node $S/manifest.mjs review "$D"        # → images/review.html, the contact sheet the owner approves — GATE
node $S/manifest.mjs csv-in "$D"        # the approved sheet wins; refuses on duplicates or a bad CSV

# 3 · optimise (installs sharp into $D/.tools on first run)
node $S/optimise-images.mjs "$D"

# 4 · upload
cp "$D/images/optimised/"* $T/optimised/ && cp "$D/images/manifest.json" $T/
npx @framer/agent@latest exec -s <id> < $S/upload.js
cp $T/uploaded.json "$D/images/"

# 5 · verify every upload is the picture we sent
node $S/verify-uploads.mjs "$D" && cp "$D/images/uploaded.json" $T/

# 6 · repoint: dry run, read every command, then apply, then verify in a SEPARATE exec
npx @framer/agent@latest exec -s <id> < $S/repoint.js
npx @framer/agent@latest exec -s <id> -e 'state.repointApply = true'
npx @framer/agent@latest exec -s <id> < $S/repoint.js
npx @framer/agent@latest exec -s <id> < $S/verify-repoint.js
cp $T/repoint-log.json $T/verify-repoint.json "$D/images/"
```

**Resume after a reboot:** `/tmp` is gone. Copy `inventory.json`, `manifest.json`,
`uploaded.json` and the optimised files back from `$D/images/` into `$T` before any exec step.
Every script is re-runnable: uploads skip what is already uploaded, repoint skips nodes that
already carry the new asset.

## Write paths, by where the image lives

| Where | Command (one per `applyChanges` call) | Trap |
|---|---|---|
| Frame fill | `SET <id> fill="<url>" altText="<alt>";` | Replicas: primary first, then only the replicas that still show the old hash (their own override). A batch of compound ids no-ops or lands the wrong value on the wrong replica |
| Component instance image control | `SET <id> $control__<key>.src="<url>" $control__<key>.alt="<alt>";` | 🚨 The bare `$control__<key>="<url>"` **wipes the image** and reports success; `.alt` alone lands, so an alt-only check passes while the photo is gone. Alt is **literal only**, a `var(--variable-…)` alt is a silent no-op |
| Component definition default | inside the component: bare `initialValue="<url>"` | The mirror image of instances: `.src` fails here. Only if every instance inherits it |
| CMS image field | `item.setAttributes({fieldData:{[fid]:{type:"image", value:<full url>, alt}}})` | `addItems` hangs 120 s and writes nothing. Reads back at `value.altText`. ⚠️ Writing a *new* URL this way is unverified: probe one item and re-read before the rest. CMS content is shared across branches, so this lands on main whatever branch you are on |
| CMS gallery, rich text, file field | by hand | Not reliably API-writable. `canvas-inventory.js` lists them; they go on the owner's list |
| Page / site metadata | `SET <pageId or rootNode> metadata.socialImage="<url>";` | Root node id is the literal `rootNode`. These stay PNG/JPG (`keep`), never WebP |
| Code component image | flag it | Its own property controls; case by case |

Every command is a single line, sent with `{ pagePath: "/" }`. A newline-joined batch
applies only its first statement.

## Traps

- 🚨 **Framer can swap the picture on re-host and keep your alt**, so the alt then describes a
  different photograph. `verify-uploads.mjs` compares pixels; `repoint.js` only touches rows it
  passed. A screenshot is not proof, and the swap has appeared *after* a good screenshot.
- 🚨 **`serialize({depth:99})` truncates.** Enumerate with `getNodesOfTypes` + `serializeNodes`
  in chunks of 25. That is what `canvas-inventory.js` does.
- ⚠️ **Upload size.** Data-URI uploads have worked at 4.7 MB and failed at 551 KB on different
  projects. Optimised files are almost always far under that. A failure goes on the drag-and-drop
  list, not into a retry loop.
- ⚠️ **Module-loader death.** On some projects instance reads and control writes fail with
  `importMap has to exist on the module` while frame writes keep working. Check
  `(await framer.getCodeFiles()).length` is non-zero before instance work; every exec script
  here refuses to run when it is 0.
- ⚠️ **"Applied cleanly" is not proof.** `verify-repoint.js`, in its own exec, re-reads every
  row: new asset present, old hash gone, alt as approved.
- ⚠️ **Replacing a fill may reset its fit or focal point** (unverified). After the first
  repoint on a project, screenshot one cropped image at each breakpoint before the rest.
- ⚠️ **An empty `altText` may not serialise** (default-valued attributes are omitted), so a
  decorative image reads as "no alt" in the API. Confirm `alt=""` in the rendered HTML after
  publish; `verify-repoint.js` lists those rows.
- Old assets are not deleted. Framer keeps them in the asset library under their old names,
  tool names included; unused assets are not served. Say so in the report.
