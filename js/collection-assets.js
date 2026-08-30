// Collection cover-art helpers.
// Square owns collection names + membership. The website only supplies cover PNGs.
//
// Drop files in `assets/collections/`. Filename = normalizeCollectionKey(name) + ".png".
// Paths are root-absolute so covers resolve from /admin/* and pretty routes.

/** Root-absolute — required so /admin/collections does not resolve to /admin/assets/… */
export const COLLECTION_COVER_DIR = "/assets/collections";
export const COLLECTION_COVER_FALLBACK = "/assets/coming-soon.png";

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
 * Public URL for a collection cover (root-absolute).
 * Missing files are detected at render time (img onerror / HEAD probe).
 */
export function collectionCoverSrc(name = "") {
  const file = collectionCoverFilename(name);
  if (!file) return COLLECTION_COVER_FALLBACK;
  return `${COLLECTION_COVER_DIR}/${file}`;
}

/** Repo-relative path shown in admin UI, e.g. assets/collections/ocean.png */
export function collectionCoverRepoPath(name = "") {
  const file = collectionCoverFilename(name);
  return file ? `assets/collections/${file}` : "";
}

/**
 * Probe whether a cover PNG exists (does not invent collections).
 * Returns { found: boolean, url: string, repoPath: string }.
 */
export async function probeCollectionCover(name = "") {
  const url = collectionCoverSrc(name);
  const repoPath = collectionCoverRepoPath(name);
  if (!repoPath) return { found: false, url, repoPath: "" };
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (res.ok) return { found: true, url, repoPath };
    // Some hosts reject HEAD — try a ranged GET.
    const get = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      cache: "no-store",
    });
    return { found: get.ok || get.status === 206, url, repoPath };
  } catch (_) {
    return { found: false, url, repoPath };
  }
}
