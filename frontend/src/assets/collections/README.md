# Collection cover images

This vanilla static site serves covers from:

`assets/collections/`

Place PNGs there using the normalized Square Collection name:

- `Sun, Moon, And Stars` → `sun-moon-and-stars.png`
- `Midnight Light` → `midnight-light.png`
- `Ocean` → `ocean.png`
- `Spooky` → `spooky.png`

Normalization (see `js/collection-assets.js`): lowercase, trim, `&` → `and`,
punctuation → hyphens, collapse repeats, add `.png`.

Add a Collection value in Square, drop the matching PNG in `assets/collections/`,
and the collection card appears automatically. Missing images fall back gracefully.
