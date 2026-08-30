// Collection cover-art helpers.
// Square owns collection names + membership. The website only supplies cover PNGs.
//
 // Drop files in `assets/collections/` (this static site’s equivalent of
 // `frontend/src/assets/collections/`). Filename = normalizeCollectionKey(name) + ".png".

export const COLLECTION_COVER_DIR = "./assets/collections";
export const COLLECTION_COVER_FALLBACK = "./assets/coming-soon.png";

/**
 * Normalize a Square Collection display name into a stable URL/file key.
 * Rules: lowercase, trim, `&` → `and`, punctuation → hyphens, collapse hyphens.
 * Examples:
 *   "Sun, Moon, And Stars" → "sun-moon-and-stars"
 *   "Moon, Sun & Stars"    → "moon-sun-and-stars"
 *   "Midnight Light"       → "midnight-light"
 */
export function normalizeCollectionKey(name = "") {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** e.g. "Midnight Light" → "midnight-light.png" */
export function collectionCoverFilename(name = "") {
  const key = normalizeCollectionKey(name);
  return key ? `${key}.png` : "";
}

/**
 * Public URL for a collection cover. Always returns a path — missing files
 * are handled at render time via img onerror / data-fallback.
 */
export function collectionCoverSrc(name = "") {
  const file = collectionCoverFilename(name);
  if (!file) return COLLECTION_COVER_FALLBACK;
  return `${COLLECTION_COVER_DIR}/${file}`;
}
