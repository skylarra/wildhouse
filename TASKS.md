# Current Sprint

## Sprint 5 — SEO, Accessibility, Performance, Testing, Launch

### SEO
- Absolute OG/Twitter meta + WebSite JSON-LD ✅
- Visible home H1 / shop H1 ✅
- Product meta + Product JSON-LD synced in JS ✅
- Sitemap product URLs + robots disallow cart/confirmation ✅

### Accessibility
- Skip links + main landmarks ✅
- `:focus-visible` on controls ✅
- Escape closes mobile nav; cart count in aria-label ✅
- Reduced-motion skips announcement rotation ✅
- Contrast fixes (nav current, favorites) ✅

### Performance
- Removed unused multi‑MB assets ✅
- Hero no longer loads 7MB SVG background ✅
- Compressed photographic assets to JPEG ✅
- Lazy-loading below-fold images + Cloudflare `_headers` ✅

### Square launch hardening
- Featured fallback when Square has no featured flags ✅
- Confirmation no longer always claims success ✅
- `/api/catalog` reports missing env var **names** + environment ✅

---

## Pending (requires user / ops)

- Confirm Square **Sandbox** secrets are on the Pages project runtime:
  `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_ENVIRONMENT=sandbox`
- Redeploy and verify: `curl -sS https://wildhouse.pages.dev/api/catalog`
  should return `_meta.environment: "sandbox"` with live items
- Connect `wildhouselane.com` DNS to the Cloudflare Pages project
- Complete sandbox checkout with Square test card before production credentials

---

## Rules

Do not build customer accounts.

Do not add frameworks.

Do not add production Square credentials until sandbox testing is complete.

Everything should remain production quality.
