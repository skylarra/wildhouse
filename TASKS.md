# Current Sprint

## Collections admin (visibility + order)

- Admin page: `/admin/collections`
- Controls only: **visibility** ON/OFF + drag **display order**
- Square remains source of truth for which products belong to a collection
- New Square collections default to **hidden**
- Public rule: `visible && productCount > 0`
- Persistence: **Save Changes** → `PUT /api/collections-config` → Cloudflare KV `COLLECTIONS_CONFIG`

### Ops (required for live Save Changes)

1. Cloudflare Pages → create KV namespace → bind as `COLLECTIONS_CONFIG`
2. Set secret/env `ADMIN_PASSWORD`
3. Redeploy so Functions pick up the binding

---

## Rules

Do not build customer accounts.

Do not add frameworks.

Do not add production Square credentials until sandbox testing is complete.

Everything should remain production quality.
