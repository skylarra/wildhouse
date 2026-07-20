# Wildhouse Lane

Custom e-commerce storefront for "Wildhouse Lane" — framework-free (plain HTML + CSS + vanilla JS ES modules), no build step, no runtime dependencies. See `README.md` for full architecture, the content-editing map, and the content-page block schema.

## Architecture at a glance

- Content is data, not code: editable copy/images/announcements/products/events live in `content/*.json` and `data/products.json`; pages render them via components. Change content there, not in HTML/JS.
- Reusable UI is componentized: `js/components.js` (announcement bar, header/nav, newsletter, footer), `js/ui.js` (product card, favorites, toast), `js/page.js` (generic content-page renderer).
- Data access is isolated in `js/content.js` and `js/catalog.js` (swap-in point for the live Square API later).
- CSS: `styles.css` is the base/legacy layer; `css/components.css` is authored mobile-first (base = mobile, `min-width` queries enhance up). New/refactored styles should stay mobile-first.

## Cursor Cloud specific instructions

- Static site with no dependencies, lint, or build tooling. The update script is intentionally a no-op verification.
- MUST be served over HTTP (not `file://`): pages use ES modules and `fetch()` to load JSON from `content/` and `data/`. Example: `python3 -m http.server 8000`, then open `http://localhost:8000/` (root now resolves to `index.html`).
- Pages render content client-side, so a hard refresh is needed to see JSON edits; there is no hot reload.
