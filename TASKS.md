# Current Sprint

## Square production cutover

Cloudflare already has `SQUARE_ENVIRONMENT=production` and a production
`SQUARE_ACCESS_TOKEN`. Live `/api/catalog` still fails until the **production**
`SQUARE_LOCATION_ID` is set (sandbox location ids are invalid in production).

### You must do (Cloudflare + Square Dashboard)

1. **Update `SQUARE_LOCATION_ID` (required now)**  
   Square Dashboard → toggle to **Production** → **Settings → Locations** → open your main location → copy **Location ID**.  
   Cloudflare Pages → **Settings → Environment variables** → Production → set `SQUARE_LOCATION_ID` to that value → **Save** → **Redeploy** the latest production deployment (env var changes need a new deploy).

2. Confirm Production env vars (all three):
   - `SQUARE_ACCESS_TOKEN` = production personal access token (or OAuth token) with Catalog + Inventory + Orders/Checkout scopes  
   - `SQUARE_LOCATION_ID` = **production** location id (not sandbox)  
   - `SQUARE_ENVIRONMENT` = `production`

3. **Square Production catalog**  
   Sandbox items do not appear in production. Ensure production Catalog has your sellable items, inventory at that location, prices, images, and the **Collection** / **Featured** custom attributes used by the site.

4. **Collections admin (KV)**  
   After the production catalog loads, open `/admin/collections` and set visibility/featured/order for the production Collection values (membership still comes from Square).

5. **Smoke test on wildhouselane.com** (after redeploy):
   - `/api/catalog` returns products with `"environment":"production"` and no error  
   - Shop + product pages load live items  
   - Add to cart → Checkout → Square-hosted payment page  
   - Complete a **small real card** test (or Square’s production test guidance) → lands on `/order-confirmation.html`  
   - Order appears in Square Dashboard (Production)

6. Optional: revoke the old **sandbox** access token if you no longer need it.

### Code defaults

- Repo default for `SQUARE_ENVIRONMENT` remains `sandbox` so local/`wrangler` without env stays safe.  
- Production is selected only by Cloudflare’s `SQUARE_ENVIRONMENT=production`.

---

## Rules

Do not build customer accounts.

Do not add frameworks.

Never commit Square secrets.

Everything should remain production quality.
