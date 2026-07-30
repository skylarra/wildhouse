# Architectural Decisions

## 2026-07-19

- Stay with HTML/CSS/Vanilla JS for v1.
- Use Square as the source of truth.
- Use localStorage until customer accounts exist.
- Host on Cloudflare Pages.

## 2026-07-26 (Sprint 4 — Square integration)

- Square API calls run server-side via **Cloudflare Pages Functions** (`functions/api/*`); the access token stays in env vars and never reaches the browser. No frontend framework or runtime dependency was added (Functions run natively on Cloudflare).
- The Function `/api/catalog` returns the **same schema as `data/products.json`**, so the frontend catalog layer is source-agnostic and **falls back to `products.json`** when Square is not configured (local/static preview).
- Checkout uses **Square Payment Links** (Square-hosted checkout) rather than the Web Payments SDK, so the site never handles card data and Square owns pricing. Cart sends only variation ids + quantities.
- `order-confirmation.html` is the Square `redirect_url` target; it clears the local cart and shows the order reference.
- Secrets required (set in Cursor + Cloudflare Pages): `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, and `SQUARE_ENVIRONMENT` (`sandbox`|`production`, defaults to `sandbox`). Sandbox first; production only after testing.
- Domain `wildhouselane.com` finalized: canonical tags added; custom domain must be connected in the Cloudflare Pages dashboard (not in-repo).

## 2026-07-30 (Dynamic collections)

- Storefront collections are derived from Square Catalog categories at runtime (`getCollections()` in `js/catalog.js`). Empty categories are omitted; products without a category appear only under All Products.
- Optional display priority lives in content, not code: `content/site.json` → `collectionOrder` (exact category name match). Unlisted categories append alphabetically.
- Adding a new collection only requires creating a Square category and assigning products — no frontend code change unless a custom order entry is desired.

## 2026-07-30 (Phase 1 — A Little Note + destination previews)

- Homepage “A Little Note” messages live in `content/notes.json` (add/edit strings only). One message is chosen per local calendar day via a stable hash so the note does not flicker on reload.
- Phase 1 Keychain Studio / Custom Creations / Post Office are lightweight content pages (`content/pages/*.json` + shared `page.js`). Full builder, inquiry backend, and Kit integration stay in later phases.
- Homepage order is fixed in `index.html`: Hero → Note → Featured Collections → Best Sellers → destination previews → About (welcome) → banner/events → footer.

## 2026-07-26 (Sprint 5 — launch hardening)

- Best Sellers uses explicit `featured` when present; otherwise falls back to in-stock Square items so the homepage is never empty after go-live.
- Order confirmation is a small state machine: no order id → warning; order lookup failure → cautious thank-you; only clear claims success when evidence exists.
- `/api/catalog` 501 responses include missing env var **names** (never values) plus resolved `environment` so sandbox vs production wiring can be verified safely.
- Photographic assets are compressed JPEGs; unused multi‑MB assets removed; Cloudflare `_headers` sets long-cache for `/assets`.
