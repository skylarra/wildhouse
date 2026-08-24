// Website-side collection configuration helpers.
// Admin controls: visibility + display order (and preserved copy/images).
// Membership always comes from Square's Collection attribute — never from this file.

export const COLLECTIONS_CONFIG_LS_KEY = "whl_collections_config";
export const ADMIN_TOKEN_SESSION_KEY = "whl_admin_token";

export function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Normalize a raw config document (v1 legacy or v2) into { version, entries[] }.
 * Legacy entries without `visible` default to visible=true so existing public
 * collections keep working until an admin saves explicitly.
 */
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
      // New explicit field: missing on legacy entries → treat as visible (already public).
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

/** Default config for a Square collection that has never been saved in admin. */
export function defaultConfigForNewCollection(displayName, sortOrder) {
  return {
    collectionKey: slugify(displayName),
    displayName,
    visible: false,
    featured: false,
    sortOrder,
    description: "",
    heroImage: "",
    featuredImage: "",
  };
}

export function indexConfigByKey(config) {
  const map = new Map();
  for (const entry of config.entries || []) {
    if (entry.collectionKey) map.set(entry.collectionKey, entry);
  }
  return map;
}

/**
 * Merge Square-detected collections (name + productCount + cover) with website config.
 * Preserves config for empty collections; creates hidden defaults for brand-new ones.
 */
export function mergeCollectionsWithConfig(detectedList, config) {
  const byKey = indexConfigByKey(config);
  const maxOrder = (config.entries || []).reduce((m, e) => Math.max(m, e.sortOrder || 0), 0);
  let nextOrder = maxOrder + 1;

  const detectedKeys = new Set();
  const merged = [];

  for (const det of detectedList) {
    const key = det.handle || det.collectionKey || slugify(det.name);
    detectedKeys.add(key);
    let cfg = byKey.get(key);
    if (!cfg) {
      cfg = defaultConfigForNewCollection(det.name || det.displayName || key, nextOrder++);
    }
    const cardImage = cfg.featuredImage || det.image || "";
    const heroImage = cfg.heroImage || cardImage || det.image || "";
    merged.push({
      id: key,
      collectionKey: key,
      handle: key,
      slug: key,
      name: det.name || cfg.displayName,
      displayName: det.name || cfg.displayName,
      count: det.count || det.productCount || 0,
      productCount: det.count || det.productCount || 0,
      image: cardImage || det.image || "",
      heroImage,
      featuredImage: cfg.featuredImage || "",
      description: cfg.description || "",
      visible: Boolean(cfg.visible),
      // Raw featured flag — public pages still require visible + products.
      featured: Boolean(cfg.featured),
      sortOrder: cfg.sortOrder,
      isConfigured: byKey.has(key),
      isNew: !byKey.has(key),
    });
  }

  // Keep orphaned configs (temporarily empty collections) so settings aren't lost.
  for (const cfg of config.entries || []) {
    if (detectedKeys.has(cfg.collectionKey)) continue;
    merged.push({
      id: cfg.collectionKey,
      collectionKey: cfg.collectionKey,
      handle: cfg.collectionKey,
      slug: cfg.collectionKey,
      name: cfg.displayName,
      displayName: cfg.displayName,
      count: 0,
      productCount: 0,
      image: cfg.featuredImage || cfg.heroImage || "",
      heroImage: cfg.heroImage || cfg.featuredImage || "",
      featuredImage: cfg.featuredImage || "",
      description: cfg.description || "",
      visible: Boolean(cfg.visible),
      featured: Boolean(cfg.featured),
      sortOrder: cfg.sortOrder,
      isConfigured: true,
      isNew: false,
      isEmpty: true,
    });
  }

  merged.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return merged;
}

export function isPublicCollection(c) {
  return Boolean(c?.visible) && Number(c?.productCount || c?.count || 0) > 0;
}

export function toSavableConfig(records) {
  return {
    version: 2,
    entries: records.map((r, i) => ({
      collectionKey: r.collectionKey || r.handle,
      displayName: r.displayName || r.name,
      visible: Boolean(r.visible),
      featured: Boolean(r.featured),
      sortOrder: Number.isFinite(Number(r.sortOrder)) ? Number(r.sortOrder) : i + 1,
      description: r.description || "",
      heroImage: r.heroImage || "",
      featuredImage: r.featuredImage || "",
    })),
  };
}
