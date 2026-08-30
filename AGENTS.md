# Wildhouse Lane

Custom e-commerce storefront for "Wildhouse Lane" — framework-free (plain HTML + CSS + vanilla JS ES modules), no build step, no runtime dependencies. See `README.md` for full architecture, the content-editing map, and the content-page block schema.

## Architecture at a glance

- Content is data, not code: editable copy/images/announcements/products/events live in `content/*.json` and `data/products.json`; pages render them via components. Change content there, not in HTML/JS. Customer-facing collections are grouped from the Square `Collection` custom attribute; cover PNGs live in `assets/collections/{normalized}.png` (`js/collection-assets.js`).
- Reusable UI is componentized: `js/components.js` (announcement bar, header/nav, newsletter, footer), `js/ui.js` (product card, favorites, toast), `js/page.js` (generic content-page renderer).
- Data access is isolated in `js/content.js` and `js/catalog.js`. `js/catalog.js` calls `/api/catalog` (live Square) and falls back to `data/products.json`.
- Square runs server-side in `functions/api/*` (Cloudflare Pages Functions): `catalog`, `checkout`, `order`, `collections-config`. Shared Square helpers live in `functions/api/_square.js`. The access token is never exposed to the browser.
- **Collections vs categories:** Square `Collection` custom attribute = collection names + membership (only source of truth). Square Categories = product types. Covers = `assets/collections/` via `normalizeCollectionKey()`. Optional admin KV is presentation-only (description/order) — never invents membership. Add a Collection value in Square + matching PNG → it appears automatically.
- Pretty collection URLs: Cloudflare `_redirects` maps `/collections/:handle` → `/collection?handle=:handle` (extensionless — never rewrite *to* `.html` or Pages’ auto `/page.html`→`/page` 308 will loop). Index `/collections` is served from `collections.html` by Pages’ built-in pretty URLs; no rewrite needed. Local static preview: use `collection.html?handle=…`.
- Admin: `/admin/collections` (optional presentation) + `/admin/products` (read-only Square Featured / Collection inspector). Set `ADMIN_PASSWORD` and bind KV `COLLECTIONS_CONFIG`.
- Homepage merchandising: Collections with products (from Square); Featured Products (Square Featured attribute). `getBestSellingProducts()` is reserved for real sales data and returns empty pre-launch.
- CSS: `styles.css` is the base/legacy layer; `css/components.css` is authored mobile-first (base = mobile, `min-width` queries enhance up). New/refactored styles should stay mobile-first.

## Cursor Cloud specific instructions

- Static site with no dependencies, lint, or build tooling. The update script is intentionally a no-op verification.
- MUST be served over HTTP (not `file://`): pages use ES modules and `fetch()` to load JSON from `content/` and `data/`. Example: `python3 -m http.server 8000`, then open `http://localhost:8000/` (root now resolves to `index.html`).
- Pages render content client-side, so a hard refresh is needed to see JSON edits; there is no hot reload.
- `python3 -m http.server` does NOT run `functions/`, so `/api/*` returns 404 and the catalog falls back to `data/products.json` — expected for local static preview. To exercise the Square Functions locally use `npx wrangler pages dev .` with `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, and `SQUARE_ENVIRONMENT=sandbox` set. No Square secrets are committed; production credentials are added only after sandbox testing.
