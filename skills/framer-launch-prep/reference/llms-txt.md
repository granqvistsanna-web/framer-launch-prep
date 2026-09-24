# llms.txt

## Where it goes

Framer serves it natively. Site Settings → **Files** → Add File, filename `llms.txt`.

🔑 **The Path field is the folder, not the full path.** Framer appends the filename.
Entering `/llms.txt` produces `/llms.txt/llms.txt`, silently, with no error and no
warning. For the root, the value is just `/`.

Result: `200`, `text/plain;charset=utf-8`, on the site's own domain. No redirect, no
gist, no external hosting. The plugin API cannot see these files, so the only way to
confirm the path is to fetch it.

## What goes in it

The value is **bulk avoidance**. A FAQ page that ships a 44-word answer inside 220 kB of
HTML is expensive for a model to use. Link the answer, not the nav.

- Open with an `#` title and a `>` blockquote carrying the **same entity facts as the
  schema**: what the organisation is, where, registration number, founding year, group.
- Then one line of contact and language.
- Then sections of links. **Answer-level URLs**: every FAQ item, every service, every
  case. Not just the ten top-level pages.
- Titles in the link text should be the real page titles, so the file stays useful as an
  index rather than a sitemap in disguise.

**Generate it from the CMS**, never by hand. Hand-written files drift from the collections
within a week. Pull slugs and titles live, build the markdown, verify every link returns
200 before shipping.

⚠️ The links are absolute. On a site that will change domain, regenerate the file at
cutover in the same pass as the schema origins.

## Shape

```
# <Organisation>

> <One paragraph: what the organisation is, where, what it does, registration number,
> founding year, group membership. Same facts as the Organization schema.>

<Language, contact, address.>

## Main pages

- [Home](ORIGIN/)
- [Services](ORIGIN/services)
…

## Service areas

- [<Area>: <what it covers>](ORIGIN/services/<area>)
…

## Services

- [<Service name>](ORIGIN/services/<slug>)
…

## Frequently asked questions

- [<The question, verbatim>](ORIGIN/faq/<slug>)
…

## Cases

- [<Case title>](ORIGIN/case/<slug>)
…
```

## Verify

```
node scripts/verify-schema.mjs <origin> --llms
```

Checks status, content-type, and that every link in the file returns 200. A dead link in
llms.txt is worse than no llms.txt: it is an index that lies.
