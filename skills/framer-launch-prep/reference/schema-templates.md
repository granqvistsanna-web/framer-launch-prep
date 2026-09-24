# Schema templates

Paste-ready blocks for Settings → Custom Code → End of `<head>`. Replace every
`ORIGIN` and every `<…>`. Keep one `@graph` for the site-wide block; per-template blocks
are separate scripts on their own templates.

⚠️ Every URL here is an absolute origin. On a site that will change domain, schedule one
search-replace across all blocks at cutover.

⚠️ Leave a field **out** rather than guessing it. A wrong `identifier` is worse than a
missing one.

---

## Site-wide: Organization + WebSite

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "ORIGIN/#organization",
      "name": "<Wordmark>",
      "legalName": "<Registered company name>",
      "alternateName": "<Common short form>",
      "url": "ORIGIN/",
      "description": "<One or two sentences that NAME THE CATEGORY in the words a person would ask the question in. Not the brand line.>",
      "logo": { "@type": "ImageObject", "url": "<logo url>", "width": 1720, "height": 345, "caption": "<Wordmark>" },
      "image": "<logo url>",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "<Street>",
        "postalCode": "<Post code>",
        "addressLocality": "<City>",
        "addressCountry": "<ISO country>"
      },
      "telephone": "<+1 555…>",
      "email": "<hello@…>",
      "identifier": { "@type": "PropertyValue", "propertyID": "<company registry, e.g. SE-orgnr, UK-CRN>", "value": "<registration number>" },
      "foundingDate": "<YYYY>",
      "areaServed": { "@type": "Country", "name": "<Country>" },
      "parentOrganization": { "@type": "Organization", "name": "<Group>", "url": "<group url>" },
      "award": [
        "<Award, year, result: campaign for client>"
      ],
      "sameAs": ["<linkedin>", "<instagram>"]
    },
    {
      "@type": "WebSite",
      "@id": "ORIGIN/#website",
      "url": "ORIGIN/",
      "name": "<Wordmark>",
      "inLanguage": "<en-US>",
      "publisher": { "@id": "ORIGIN/#organization" }
    }
  ]
}
</script>
```

`award` and `sameAs`: five to ten of the strongest. Not the whole CMS.

---

## FAQ item template

One question per page. Usually the highest-value block on the site.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "ORIGIN/<faq-path>/{{slug}}#faq",
  "url": "ORIGIN/<faq-path>/{{slug}}",
  "inLanguage": "<en-US>",
  "publisher": { "@id": "ORIGIN/#organization" },
  "isPartOf": { "@id": "ORIGIN/#website" },
  "mainEntity": [
    {
      "@type": "Question",
      "name": {{question}},
      "acceptedAnswer": { "@type": "Answer", "text": {{answer}} }
    }
  ]
}
</script>
```

🚨 Do **not** add an `about` or `category` field fed by a CMS **reference** field. That is
the exact expression that shipped unrendered on 52 live pages and voided every block:

```
"about": { "@type": "Thing", "name": {{someId.refFieldId | json}} }
```

If a taxonomy value is wanted, hardcode it per template, or verify with `verify.mjs`
before believing it.

---

## Service template

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": "ORIGIN/<services-path>/{{slug}}#service",
  "url": "ORIGIN/<services-path>/{{slug}}",
  "name": {{name}},
  "description": {{description}},
  "inLanguage": "<en-US>",
  "provider": { "@id": "ORIGIN/#organization" },
  "areaServed": { "@type": "Country", "name": "<Country>" }
}
</script>
```

Same warning: no reference-field interpolation.

---

## Article template

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": "ORIGIN/<blog-path>/{{slug}}#article",
  "url": "ORIGIN/<blog-path>/{{slug}}",
  "headline": {{title}},
  "description": {{excerpt}},
  "datePublished": {{published}},
  "dateModified": {{updated}},
  "inLanguage": "<en-US>",
  "author": { "@type": "Person", "name": {{authorName}} },
  "publisher": { "@id": "ORIGIN/#organization" },
  "isPartOf": { "@id": "ORIGIN/#website" }
}
</script>
```

`headline` should stay under about 110 characters.

---

## BreadcrumbList

Cheap, and it states the hierarchy explicitly rather than leaving it to be inferred.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "<Hub name>", "item": "ORIGIN/<hub>" },
    { "@type": "ListItem", "position": 2, "name": {{title}} }
  ]
}
</script>
```

The last item takes no `item` — it is the current page.
