# Launch & testing checklist

Manual smoke tests for Wildhouse Lane (no test framework). Run against the Cloudflare Pages deploy (`https://wildhouse.pages.dev` until the custom domain is connected).

## Square environment accuracy

```bash
curl -sS https://wildhouse.pages.dev/api/catalog | jq .
```

Expected when sandbox secrets are correct:

- HTTP **200**
- `_meta.source` = `"square"`
- `_meta.environment` = `"sandbox"` (not `"production"`)
- `objects` contains live Square item ids (not `ITEM_*` placeholders)

If HTTP **501**:

- `missing` lists which runtime vars are absent (`SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`)
- `environment` shows the resolved mode (defaults to `sandbox`)

Required Pages **Production** secrets:

- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_ID`
- `SQUARE_ENVIRONMENT=sandbox`

Redeploy after changing secrets, then re-run the curl check.

## Functional smoke

1. Home loads; Best Sellers shows products (featured or in-stock fallback).
2. Shop lists catalog items; search/filter/sort work.
3. Product page updates title/meta; add-to-cart toast works.
4. Cart quantity/remove/subtotal work.
5. Checkout redirects to a **sandbox.square.link** / Square sandbox URL (not production).
6. After sandbox payment, confirmation page shows order reference without false claims when lookup fails.
7. Keyboard: skip link, Escape closes mobile nav, focus rings visible.
8. `wildhouselane.com` resolves to the Pages project (not a parking page).

## Do not launch until

- [ ] `/api/catalog` returns Square sandbox data
- [ ] Sandbox checkout completes with a test card
- [ ] Custom domain points at Cloudflare Pages
- [ ] Production Square credentials are still **not** enabled
