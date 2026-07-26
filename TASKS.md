# Current Sprint

## Sprint 4 — Square Integration

### Catalog & Inventory
- Server-side Square Catalog fetch (Cloudflare Pages Function) ✅
- Real-time inventory counts ✅
- Same schema as products.json + graceful fallback ✅

### Checkout
- Square Payment Links (hosted checkout, no card handling) ✅
- Cart posts variation ids + quantities to /api/checkout ✅

### Order Confirmation
- order-confirmation.html redirect target ✅
- Clears cart, shows order reference/summary ✅

### Domain
- wildhouselane.com finalized (canonical tags) ✅

---

## Pending (requires user)

- Add Square **Sandbox** credentials as secrets to enable/verify the live path:
  `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_ENVIRONMENT=sandbox`.
- Connect `wildhouselane.com` to the Cloudflare Pages project and set the same
  env vars there. Add production credentials only after sandbox testing passes.

---

## Rules

Do not build customer accounts.

Do not add frameworks.

Do not add production Square credentials until sandbox testing is complete.

Everything should remain production quality.

---

## Next: Sprint 5

SEO, accessibility, performance, testing, launch.
