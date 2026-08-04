# Current Sprint

## Phase 4 — Keychain Studio redesign

### Done
- PNG-layer, data-driven configurator (`content/studio.json`)
- Reference assembly preview: clasp hub → LEFT 3 jump rings + mini · CENTER 1 jump ring + main · RIGHT mini clasp (gold/silver matching rings) then (jump ring → bead)… ending on a bead
- Uniform option chips; no scroll jump on select; partial layer updates + preload
- Desktop: config left, preview right · Mobile: sticky preview top, cards below
- Cart product: “Build Your Own Charm Set” with design note (checkout unchanged)

### Replace placeholders
Drop real transparent PNGs over:
- `assets/studio/clasps/`
- `assets/studio/jump-rings/gold.png` and `silver.png` (user uploading)
- `assets/studio/mini-clasps/gold.png` and `silver.png`
- `assets/studio/beads/colors/`
- `assets/studio/charms/`
- `assets/studio/mini/`

Keep filenames or update paths in `content/studio.json`.

### Ops
- Point `catalogVariationId` at the Square “Build Your Own Charm Set” variation

---

## Rules

Do not build customer accounts.

Do not add frameworks.

Do not add production Square credentials until sandbox testing is complete.

Everything should remain production quality.
