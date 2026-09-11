// Local /assets URL helpers + collection cover paths.
//
// Cache model (see `_headers` + scripts/update-asset-versions.py):
// - JS/CSS/HTML/JSON revalidate every visit (ETag → cheap 304s).
// - /assets/* are long-cached immutable, so every local asset URL must include
//   ?v=<content-hash> from js/asset-versions.js.

import { ASSET_CONTENT_HASHES } from "./asset-versions.js";

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

/** Turn ./assets/… or assets/… into a root-absolute path for any route depth. */
export function absolutizeAssetUrl(path = "") {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  return `/${raw.replace(/^\.\//, "").replace(/^\/+/, "")}`;
}

/**
 * Append ?v=<sha256-12> for known local /assets files so deploys bust caches.
 * External URLs (Square CDN, etc.) are returned unchanged. Idempotent.
 */
export function withAssetContentHash(url = "") {
  const raw = String(url || "").trim();
  if (!raw) return "";

  // Absolute remote URLs that are not our /assets tree — leave alone.
  if (/^(https?:|data:|blob:)/i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (!parsed.pathname.startsWith("/assets/")) return raw;
      return applyHashToPath(parsed.pathname);
    } catch (_) {
      return raw;
    }
  }

  const abs = absolutizeAssetUrl(raw.split("?")[0] || raw);
  if (!abs.startsWith("/assets/")) return abs;
  return applyHashToPath(abs);
}

function applyHashToPath(pathname = "") {
  const path = String(pathname || "").split("?")[0];
  const hash =
    ASSET_CONTENT_HASHES[path] ||
    // Legacy filename-only keys (older asset-versions.js) — keep working once.
    ASSET_CONTENT_HASHES[path.split("/").pop() || ""];
  if (!hash) return path;
  return `${path}?v=${hash}`;
}

/**
 * Deep-walk JSON/content values and content-hash any local /assets string.
 * Used by loadJSON so footer logos, home heroes, studio layers, etc. all bust.
 */
export function versionAssetUrlsInData(value) {
  if (typeof value === "string") {
    if (!/(?:^|\/|\.)assets\//.test(value)) return value;
    if (/^(https?:|data:|blob:)/i.test(value) && !value.includes("/assets/")) {
      return value;
    }
    return withAssetContentHash(value);
  }
  if (Array.isArray(value)) return value.map(versionAssetUrlsInData);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = versionAssetUrlsInData(child);
    }
    return out;
  }
  return value;
}

/** Versioned coming-soon fallback used by collection/product cards. */
export function collectionCoverFallbackSrc() {
  return withAssetContentHash(COLLECTION_COVER_FALLBACK);
}

/** e.g. "Midnight Light" → "midnight-light.png" */
export function collectionCoverFilename(name = "") {
  const key = normalizeCollectionKey(name);
  return key ? `${key}.png` : "";
}

/**
 * Public URL for a collection cover (root-absolute + content-hash query).
 * Missing files are detected at render time (img onerror / HEAD probe).
 */
export function collectionCoverSrc(name = "") {
  const file = collectionCoverFilename(name);
  if (!file) return collectionCoverFallbackSrc();
  return withAssetContentHash(`${COLLECTION_COVER_DIR}/${file}`);
}

/**
 * Prefer an optional website override (seed/KV featuredImage or heroImage),
 * otherwise the filesystem convention assets/collections/{key}.png.
 */
export function resolveCollectionCover(name = "", overridePath = "") {
  const fromConfig = absolutizeAssetUrl(overridePath);
  if (fromConfig) return withAssetContentHash(fromConfig);
  return collectionCoverSrc(name);
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
