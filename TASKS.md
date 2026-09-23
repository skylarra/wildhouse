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

## Email list + checkout fulfillment (this PR)

### Cloudflare — new secrets / vars (Production)

| Name | Type | Purpose |
|------|------|---------|
| `RESEND_API_KEY` | Secret | Resend API key for transactional email |
| `EMAIL_FROM` | Variable | Verified sender, e.g. `Wildhouse Lane <hello@wildhouselane.com>` |
| `NEWSLETTER_NOTIFY_TO` | Variable (optional) | Defaults to `skylar@wildhouselane.com` |
| `ORDER_NOTIFY_TO` | Variable (optional) | Owner order alerts; defaults to `skylar@wildhouselane.com` |
| `SHIPPING_FEE_CENTS` | Variable (optional) | Flat shipping fee applied via Square Payment Link (default `699`) |
| `FREE_SHIPPING_THRESHOLD_CENTS` | Variable (optional) | Waive shipping at this catalog subtotal (default `7500`) |
| `PICKUP_ADDRESS` | Secret/Variable | Shown only after a pickup order + in emails |
| `PICKUP_INSTRUCTIONS` | Variable | Pickup instructions for customer email |
| `PICKUP_CONTACT` | Variable | Contact line for pickup emails |

Do **not** change existing Square production secrets (`SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_ENVIRONMENT`) or `ADMIN_PASSWORD` / `COLLECTIONS_CONFIG`.

### Cloudflare — KV binding

1. Workers & Pages → KV → Create namespace (e.g. `wildhouse-email-subscribers`).
2. Pages project → Settings → Functions → KV namespace bindings → Add:
   - Variable name: `EMAIL_SUBSCRIBERS`
   - KV namespace: the one you created
3. Redeploy.

### Resend

1. Create a Resend account and verify `wildhouselane.com` (or your sending domain).
2. Create an API key → set as `RESEND_API_KEY`.
3. Set `EMAIL_FROM` to a verified address on that domain.

### Square Dashboard (required for tax)

1. Production → **Items → Taxes** (or Settings → Sales tax): configure your tax rates / locations.
2. Ensure taxable catalog items have the tax applied (Square auto-apply uses these catalog tax rules).
3. Shipping is a **flat fee** on Payment Links (`SHIPPING_FEE_CENTS`) — Square Payment Links do **not** return live carrier rates by address. Free shipping uses `FREE_SHIPPING_THRESHOLD_CENTS` against the Square catalog subtotal.
4. Local pickup uses Square order fulfillments type `PICKUP` (free; no shipping address asked).

### Production smoke test (no live card charge for newsletter)

1. Newsletter: submit a new email on the site → expect success UI; check KV for `sub:{sha256}`; check inbox for “New Wildhouse Lane Subscriber”. Submit same email again → “already on the list”, no second owner email.
2. Cart: choose **Ship to me** vs **Local pickup — FREE**; shipping line updates; Checkout redirects to Square.
3. On Square sandbox/test (or a tiny production charge you authorize): complete payment → land on order confirmation → owner gets “NEW WILDHOUSE LANE ORDER” with fulfillment; pickup orders get pickup instructions email (address from env).

