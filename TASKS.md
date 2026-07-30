# Current Sprint

## Dynamic collections + product card polish

- Product cards use consistent 4:5 portrait frames (`object-fit: contain`) ✅
- Collections are generated from Square categories (via `/api/catalog` / `products.json`) ✅
- Optional `collectionOrder` in `content/site.json` ✅
- Homepage features dynamic collections ✅
- Empty categories hidden; uncategorized products only under All Products ✅

---

## Pending (requires user / ops)

- Populate Square Sandbox catalog with real categories + products
- Connect `wildhouselane.com` DNS to the Cloudflare Pages project
- Complete sandbox checkout with Square test card before production credentials

---

## Rules

Do not build customer accounts.

Do not add frameworks.

Do not add production Square credentials until sandbox testing is complete.

Everything should remain production quality.
