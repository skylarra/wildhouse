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

- ~~Storefront collections are derived from Square Catalog categories~~ **Superseded 2026-08-23.**

## 2026-08-23 (Collection visibility admin)

- Website-side config controls **visible**, **featured**, **sortOrder**, description, and images. Square `Collection` attribute still owns membership only.
- Public rule: `visible === true` AND `productCount > 0`. New Square collections with no config default to **visible OFF**.
- Empty collections keep their saved config (not deleted) but stay hidden publicly until products return.
- Admin UI at `/admin/collections` (noindex). Live persistence: Cloudflare KV binding `COLLECTIONS_CONFIG` + env `ADMIN_PASSWORD` via `PUT /api/collections-config`. Fallback: download JSON into `content/collections.json` or localStorage draft on static preview.
- Featured cannot override visibility: homepage featured strip only includes public + featured collections (no fallback to “all”).

## 2026-08-23 (Square Collection attribute)

- **Membership:** Square Catalog custom attribute named `Collection` is the single source of truth for which thematic collection a product belongs to (`custom.collection` / `custom.collections` in the catalog payload).
- **Product type:** Square Categories stay separate (Shop sidebar + collection-page type filters). Do not use Categories for collection membership.
- **Presentation only:** `content/collections.json` holds description, heroImage, featured, and display `order` matched by exact Collection name or slug — never membership.
- **URLs:** `collection.html?handle=<slug>` works everywhere; Cloudflare `_redirects` serves `/collections/:handle` as a pretty rewrite. Display names are preserved exactly; only slugs are transformed.
- Products without a Collection attribute still appear in Shop and are omitted from collection pages (no public “Uncategorized” collection).
- Sold-out items remain in their collection; archived/deleted Square items are excluded in `squareToCatalog()`.

## 2026-07-30 (Phase 1 — A Little Note + destination previews)

- Homepage “A Little Note” messages live in `content/notes.json` (add/edit strings only). One message is chosen per local calendar day via a stable hash so the note does not flicker on reload.
- Phase 1 Keychain Studio / Custom Creations / Post Office are lightweight content pages (`content/pages/*.json` + shared `page.js`). Full builder, inquiry backend, and Kit integration stay in later phases.
- Homepage order is fixed in `index.html`: Hero → Note → Featured Collections → Best Sellers → destination previews → About (welcome) → banner/events → footer.

## 2026-07-30 (Phase 2 — Collection pages + storytelling metadata)

- Dedicated pages at `collection.html?handle=…` / `/collections/:handle` with edge-to-edge hero image and intro copy below (no overlay badges).
- Storytelling (description, optional `heroImage`, `featured`, display `order`) lives in `content/collections.json`. **Membership** is the Square `Collection` attribute (see 2026-08-23).
- Shop `?category=` filters by Square Category (product type), not thematic collection.

## 2026-08-03 (Phase 3 — Product page experience)

- Product gallery uses a consistent **4:5** frame with `object-fit: contain` (same language as shop cards) so product photography isn’t cropped oddly.
- Zoom is a native `<dialog>` lightbox with keyboard arrows / Escape — no Canvas or third-party zoom library.
- Shared shipping, handmade, and processing copy lives in `content/product-info.json` so studio messaging can change without touching JS. Free-shipping threshold still reads from `content/site.json` when present.
- Inventory status is variation-aware (in stock / low / sold out); quantity is capped to available stock on add-to-cart.
- Multi-axis Square variations named like `Black / M` render as separate sections: **Color** (image swatches) then **Size** (chips). Parsing lives in `js/variants.js`. Color photos come from Square variation `image_ids` when present, else `custom.colorImages` / `content/variant-media.json`, else product image order.
- Product descriptions prefer Square `description_html` (sanitized to Square’s supported tags) so dashboard spacing/lists/bold match the site. Plain-text descriptions keep `\n` / `\n\n` as `<br>` / paragraphs via `formatProductDescription()` in `js/ui.js`.

## 2026-08-04 (Phase 4 — Keychain Studio)

- Studio V1 uses **stacked transparent PNG layers** (`assets/studio/`), not Canvas or 3D, for fast reliable previews.
- Options, prices, and layer paths are data-driven via `content/studio.json` sections → slots. Add a PNG + JSON option to extend; set `enabled: false` to hide a section.
- Preview is a fixed **4:5** product-photo composition (clasp above, main centered, mini to one side, beads curving down the other) with slight rotations/overlap.
- Option changes **crossfade a single layer** (~200ms) without re-rendering the page or changing scroll position. Images are preloaded.
- Cart lines for studio builds use a unique local `variationId` plus `catalogVariationId` (Square variation) and a human-readable `note`. Checkout is unchanged aside from passing that note. Product title: **Build Your Own Charm Set**.
- Until Square has a matching variation, local fallback uses `VAR_CUSTOM_KEYCHAIN` in `data/products.json`.

## 2026-07-26 (Sprint 5 — launch hardening)

- Best Sellers uses explicit `featured` when present; otherwise falls back to in-stock Square items so the homepage is never empty after go-live.
- Order confirmation is a small state machine: no order id → warning; order lookup failure → cautious thank-you; only clear claims success when evidence exists.
- `/api/catalog` 501 responses include missing env var **names** (never values) plus resolved `environment` so sandbox vs production wiring can be verified safely.
- Photographic assets are compressed JPEGs; unused multi‑MB assets removed; Cloudflare `_headers` sets long-cache for `/assets`.
