# Current Sprint

## Collection visibility admin

- Admin page: `/admin/collections` (toggles, featured, drag-reorder, description/images)
- Public collections require `visible` + at least one product
- New Square collections default to hidden until enabled in admin
- Persistence: KV `COLLECTIONS_CONFIG` + `ADMIN_PASSWORD`, or download `content/collections.json`

### Ops to enable live admin saves

1. Cloudflare Pages → create KV namespace → bind as `COLLECTIONS_CONFIG`
2. Set secret/env `ADMIN_PASSWORD`
3. Redeploy Functions

---

## Rules

Do not build customer accounts.

Do not add frameworks.

Do not add production Square credentials until sandbox testing is complete.

Everything should remain production quality.
