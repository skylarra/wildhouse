# Current Sprint

## Pre-launch merchandising pass

- Homepage: **FEATURED PRODUCTS** (Square Featured attribute) — never “Best Sellers” with zero sales
- `getBestSellingProducts()` stub returns `[]` until real Square sales data exists
- Featured Collections: `visible && productCount > 0 && featured`, ordered by admin config
- Collections admin: visibility, featured, order, description, images → KV
- Products admin (read-only): inspect Featured + Collection from Square
- Multi-value Square Collection attribute supported for membership counts/filters

### Ops
1. Bind KV `COLLECTIONS_CONFIG` + set `ADMIN_PASSWORD`
2. Mark products Featured in Square for homepage
3. Square production credentials only after sandbox QA

---

## Rules

Do not build customer accounts.

Do not add frameworks.

Do not add production Square credentials until sandbox testing is complete.

Everything should remain production quality.
