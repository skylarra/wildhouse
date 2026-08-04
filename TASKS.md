# Current Sprint

## Phase 4 — Keychain Studio

### In this pass
- Interactive builder on `keychain-studio.html`
- Hardware → Standard/Beaded → bead sequence → main charm → mini charm
- Live layered SVG preview (`assets/studio/`)
- Config in `content/studio.json` (options + prices)
- Add to cart with unique design + note for Square checkout
- Local catalog item `VAR_CUSTOM_KEYCHAIN` for fallback checkout wiring

### Ops follow-up
- Create matching “Custom Keychain” item/variation in Square and set `catalogVariationId` in `content/studio.json`
- Optionally replace SVG placeholders with photographic PNGs using the same paths

### Out of scope
- Save / share designs
- Auto-generated design names
- Canvas / 3D preview
- Custom Creations inquiry backend (Phase 5)

---

## Rules

Do not build customer accounts.

Do not add frameworks.

Do not add production Square credentials until sandbox testing is complete.

Everything should remain production quality.
