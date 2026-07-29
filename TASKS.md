# Current Sprint

## Hotfix — restore Sprint 5 visual regressions

Priority: restore frontend polish and shop fallback before any further feature work.

- Restore pre–Sprint 5 hero/layout/typography styling
- Shop must show local `products.json` when Square is empty/unavailable
- Do not start Sprint 6 or new features until verified

---

## Sprint 5 — SEO, Accessibility, Performance, Testing, Launch

Completed in PR #4. Some visual changes from that sprint are being restored in this hotfix.

---

## Pending (requires user / ops)

- Populate Square Sandbox catalog (live `/api/catalog` currently returns 0 items)
- Connect `wildhouselane.com` DNS to the Cloudflare Pages project
- Complete sandbox checkout with Square test card before production credentials

---

## Rules

Do not build customer accounts.

Do not add frameworks.

Do not add production Square credentials until sandbox testing is complete.

Everything should remain production quality.
