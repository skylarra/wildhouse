# Collection cover images

This vanilla static site serves covers from:

`assets/collections/`

Place PNGs there using the normalized Square Collection name:

- `Moon, Sun, and Stars` → `moon-sun-and-stars.png`
- `Midnight Light` → `midnight-light.png`
- `Ocean Wonders` → `ocean-wonders.png`
- `Witches Lane` → `witches-lane.png`

Normalization (see `js/collection-assets.js`): lowercase, trim, `&` → `and`,
punctuation → hyphens, collapse repeats, add `.png`.

Optional: set `featuredImage` / `heroImage` in `content/collections.json` or admin
KV (root-absolute path like `/assets/collections/….png`) to override the
filename convention for a single collection.

Add a Collection value in Square, drop the matching PNG in `assets/collections/`,
and the collection card appears automatically. Missing images fall back gracefully.

## Cache busting (required after replacing covers)

Cover `<img>` URLs append `?v=<content-hash>` so returning browsers (especially
Safari) fetch new bytes after a deploy, even if they previously cached the
unversioned `/assets/…` URL as `immutable`.

After replacing any file under `assets/collections/` or `assets/coming-soon.png`:

```bash
python3 scripts/update-asset-versions.py
```

Commit the regenerated `js/asset-versions.js` with the new images.
