// Shared collections-config helpers for Cloudflare Pages Functions.
// Mirrors the public rules in js/collections-config.js (kept separate — Functions
// cannot import from /js on the static site).

export function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeCollectionsConfig(raw = {}) {
  const legacyOrder = Array.isArray(raw.order) ? raw.order : [];
  const orderRank = new Map(legacyOrder.map((name, i) => [name, i + 1]));
  const list = Array.isArray(raw.entries) ? raw.entries : [];

  const entries = list.map((entry, index) => {
    const displayName = entry.displayName || entry.name || "";
    const collectionKey =
      entry.collectionKey || entry.handle || (displayName ? slugify(displayName) : `collection-${index + 1}`);
    const sortFromLegacy = orderRank.has(displayName) ? orderRank.get(displayName) : null;
    const sortOrder = Number.isFinite(Number(entry.sortOrder))
      ? Number(entry.sortOrder)
      : sortFromLegacy ?? index + 1;

    return {
      collectionKey,
      displayName,
      visible: entry.visible === undefined ? true : Boolean(entry.visible),
      featured: Boolean(entry.featured),
      sortOrder,
      description: entry.description || "",
      heroImage: entry.heroImage || "",
      featuredImage: entry.featuredImage || entry.image || "",
    };
  });

  entries.sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName));
  return { version: 2, entries };
}

export const KV_KEY = "collections-config";
