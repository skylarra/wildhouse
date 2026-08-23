# Current Sprint

## Square Collection attribute → website collections

- Customer-facing collections come from the Square Catalog custom attribute **`Collection`** (not Square Categories)
- Square Categories remain product types for Shop filters + collection-page type chips
- Presentation (copy/hero/featured/order) stays in `content/collections.json`
- Pretty URLs via Cloudflare `_redirects`: `/collections/:handle`
- Instagram / TikTok handles → `@wildhouselane`

### Still open (ops)

- Assign `Collection` custom attribute values on live Square items
- Confirm Instagram/TikTok profiles are `@wildhouselane` (URLs updated in site content)
- Sandbox checkout + catalog Functions with Collection attribute present

---

## Rules

Do not build customer accounts.

Do not add frameworks.

Do not add production Square credentials until sandbox testing is complete.

Everything should remain production quality.
