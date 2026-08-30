// Wildhouse Lane — catalog access layer.
// Loads the live Square catalog (via /api/catalog) or falls back to
// data/products.json.
//
// Architecture (do not invert):
// - Square `Collection` custom attribute → ONLY source of collection names
//   and product membership (grouped by unique Square value)
// - Square Categories → product type (shop filters / collection type chips)
// - Website → cover PNGs in assets/collections/ (normalized filename),
//   optional KV presentation (description/order) — never invents membership
// - Square Featured custom attribute → product.featured (manual merchandising)
// - Best sellers → getBestSellingProducts() (sales data later; empty for launch)

import { loadJSON, sitePath } from "./content.js";
import {
  normalizeCollectionsConfig,
  indexConfigByKey,
} from "./collections-config.js";
import {
  normalizeCollectionKey,
  collectionCoverSrc,
} from "./collection-assets.js";

let cache = null;
let collectionsMetaCache = null;

export function formatMoney(cents, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    (cents || 0) / 100
  );
}

/** Generic URL slug (categories / product handles). Prefer normalizeCollectionKey for collections. */
export function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export { normalizeCollectionKey, collectionCoverSrc };

/** Collection detail URL. Prefer pretty `/collections/:handle` in production
 *  (`_redirects` → `/collection?handle=…`). Query form works locally too. */
export function collectionHref(handle) {
  if (!handle) return "./collections.html";
  return `./collections/${encodeURIComponent(handle)}`;
}

async function loadRaw() {
  if (cache) return cache;
  try {
    const live = await fetch(sitePath("api/catalog"), { cache: "no-store" });
    if (live.ok) {
      const data = await live.json();
      if (Array.isArray(data?.objects) && data.objects.length > 0) {
        cache = data;
        return cache;
      }
    }
  } catch (_) {
    /* static host without Functions — use local fallback */
  }
  const res = await fetch(sitePath("data/products.json"), { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load catalog: ${res.status}`);
  cache = await res.json();
  return cache;
}

/**
 * Load website collection configuration.
 * Priority: /api/collections-config (KV, then seed) → content/collections.json
 * Browser drafts are intentionally not used on the public site.
 */
export async function loadCollectionsMeta({ bust = false } = {}) {
  if (!bust && collectionsMetaCache) return collectionsMetaCache;

  try {
    const live = await fetch(sitePath("api/collections-config"), { cache: "no-store" });
    if (live.ok) {
      const data = await live.json();
      if (Array.isArray(data?.entries)) {
        collectionsMetaCache = normalizeCollectionsConfig(data);
        return collectionsMetaCache;
      }
    }
  } catch (_) {
    /* no Functions */
  }

  try {
    const seed = await loadJSON("content/collections.json");
    collectionsMetaCache = normalizeCollectionsConfig(seed);
  } catch (_) {
    collectionsMetaCache = { version: 2, entries: [] };
  }
  return collectionsMetaCache;
}

export function clearCollectionsMetaCache() {
  collectionsMetaCache = null;
}

function collectionNamesFromCustom(custom = {}) {
  if (Array.isArray(custom.collections) && custom.collections.length) {
    return custom.collections.map((n) => String(n).trim()).filter(Boolean);
  }
  if (custom.collection) return [String(custom.collection).trim()].filter(Boolean);
  return [];
}

function normalize(raw) {
  const catById = new Map(raw.categories.map((c) => [c.id, c.category_data]));
  const inventory = raw.inventory || {};
  const images = raw.images || {};

  return raw.objects
    .filter((o) => o.type === "ITEM")
    .map((obj) => {
      const d = obj.item_data;
      const category = d.category_id ? catById.get(d.category_id) : null;
      const variations = (d.variations || []).map((v) => {
        const vd = v.item_variation_data || {};
        const variationImageIds = vd.image_ids || v.image_ids || [];
        return {
          id: v.id,
          name: vd.name,
          sku: vd.sku,
          priceCents: vd.price_money?.amount || 0,
          currency: vd.price_money?.currency || raw.currency || "USD",
          stock: inventory[v.id] ?? 0,
          image: variationImageIds.map((id) => images[id]?.url).find(Boolean) || null,
        };
      });
      const prices = variations.map((v) => v.priceCents);
      const totalStock = variations.reduce((s, v) => s + v.stock, 0);

      const collectionNames = collectionNamesFromCustom(obj.custom);
      const collectionName = collectionNames[0] || null;
      const collectionHandle = collectionName ? normalizeCollectionKey(collectionName) : null;

      return {
        id: obj.id,
        name: d.name,
        description: d.description || "",
        descriptionHtml: d.description_html || obj.custom?.description_html || "",
        handle: obj.custom?.handle || obj.id,
        tags: obj.custom?.tags || [],
        featured: Boolean(obj.custom?.featured),
        colorImages: obj.custom?.colorImages || {},
        categoryId: d.category_id || null,
        categoryName: category?.name || "",
        categoryHandle: category?.handle || null,
        collectionNames,
        collectionName,
        collectionHandle,
        images: (d.image_ids || []).map((id) => images[id]?.url).filter(Boolean),
        variations,
        minPriceCents: prices.length ? Math.min(...prices) : 0,
        maxPriceCents: prices.length ? Math.max(...prices) : 0,
        hasVariants: variations.length > 1,
        inStock: totalStock > 0,
        totalStock,
      };
    });
}

export async function getProducts() {
  const raw = await loadRaw();
  return normalize(raw);
}

/**
 * Square-only collection detection shared by public + admin.
 * - Membership & names: Collection custom attribute on products
 * - Plus (admin): empty options from the Square Collection definition
 * Never invents collections from website seed/KV alone.
 */
export function detectSquareCollections(products = [], raw = {}, { includeEmptyOptions = false } = {}) {
  const counts = new Map();
  const names = new Map();

  const ensure = (displayName) => {
    const label = String(displayName || "").trim();
    if (!label) return null;
    const handle = normalizeCollectionKey(label);
    if (!handle) return null;
    if (!names.has(handle)) names.set(handle, label);
    if (!counts.has(handle)) counts.set(handle, 0);
    return handle;
  };

  for (const p of products) {
    const list =
      Array.isArray(p.collectionNames) && p.collectionNames.length
        ? p.collectionNames
        : p.collectionName
          ? [p.collectionName]
          : [];
    for (const displayName of list) {
      const handle = ensure(displayName);
      if (!handle) continue;
      counts.set(handle, (counts.get(handle) || 0) + 1);
    }
  }

  if (includeEmptyOptions) {
    for (const option of raw?.collectionOptions || []) {
      ensure(option);
    }
  }

  return [...names.keys()]
    .map((handle) => {
      const name = names.get(handle);
      const productCount = counts.get(handle) || 0;
      const image = collectionCoverSrc(name);
      return {
        id: handle,
        handle,
        slug: handle,
        collectionKey: handle,
        name,
        displayName: name,
        count: productCount,
        productCount,
        image,
        heroImage: image,
        featuredImage: image,
        description: "",
        visible: true,
        featured: false,
        sortOrder: 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Group products by unique Square Collection attribute values (public list).
 * Display names are kept exactly as Square provides them.
 */
export function buildCollectionsFromProducts(products = []) {
  return detectSquareCollections(products, {}, { includeEmptyOptions: false }).filter(
    (c) => c.productCount > 0
  );
}

/** True when a product belongs to a collection handle (primary or multi-value). */
export function productInCollection(product, handle) {
  if (!product || !handle) return false;
  const target = normalizeCollectionKey(handle);
  if (!target) return false;
  if (normalizeCollectionKey(product.collectionHandle || "") === target) return true;
  return (product.collectionNames || []).some((n) => normalizeCollectionKey(n) === target);
}

/**
 * Admin records: SAME Square-derived collections as the public site, plus any
 * empty Square Collection definition options (still Square — never seed orphans).
 * KV/seed overlays description / visible / featured / sortOrder only.
 */
export async function getAllCollectionRecords() {
  const [raw, products, meta] = await Promise.all([
    loadRaw(),
    getProducts(),
    loadCollectionsMeta(),
  ]);

  // Include empty Square definition options so admin can see all Square values;
  // public getCollections() still filters to productCount > 0.
  const detected = detectSquareCollections(products, raw, { includeEmptyOptions: true });
  const configByKey = indexConfigByKey(meta);

  return detected
    .map((c) => {
      const cfg = configByKey.get(c.handle);
      const cover = collectionCoverSrc(c.name);
      return {
        ...c,
        image: cover,
        heroImage: cover,
        featuredImage: cover,
        description: cfg?.description || "",
        // Presentation-only. Public listing is Square membership, not this flag.
        visible: cfg ? Boolean(cfg.visible) : c.productCount > 0,
        featured: cfg ? Boolean(cfg.featured) : false,
        sortOrder: Number.isFinite(Number(cfg?.sortOrder)) ? Number(cfg.sortOrder) : 0,
        isConfigured: Boolean(cfg),
        isNew: !cfg,
      };
    })
    .sort(
      (a, b) =>
        (a.sortOrder || 0) - (b.sortOrder || 0) ||
        Number(b.productCount > 0) - Number(a.productCount > 0) ||
        a.name.localeCompare(b.name)
    );
}

/**
 * Public collections: one card per unique Square Collection value that has
 * products. Names are exact Square strings; covers from assets/collections/.
 * Optional KV description/order overlay does not invent membership.
 */
export async function getCollections() {
  const products = await getProducts();
  const built = buildCollectionsFromProducts(products);
  let meta;
  try {
    meta = await loadCollectionsMeta();
  } catch (_) {
    meta = { version: 2, entries: [] };
  }
  const byKey = indexConfigByKey(meta);
  return built
    .map((c) => {
      const cfg = byKey.get(c.handle);
      if (!cfg) return c;
      return {
        ...c,
        // Keep Square name + filesystem cover; allow optional story copy/order.
        description: cfg.description || "",
        sortOrder: Number(cfg.sortOrder) || 0,
      };
    })
    .sort(
      (a, b) =>
        (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name)
    );
}

/**
 * Product types from Square Categories (not collections).
 */
export async function getProductTypes() {
  const [raw, products] = await Promise.all([loadRaw(), getProducts()]);
  const counts = new Map();
  for (const p of products) {
    if (!p.categoryId) continue;
    counts.set(p.categoryId, (counts.get(p.categoryId) || 0) + 1);
  }

  return (raw.categories || [])
    .map((c) => {
      const data = c.category_data || {};
      return {
        id: c.id,
        name: data.name || "Product type",
        handle: data.handle || c.id,
        count: counts.get(c.id) || 0,
      };
    })
    .filter((t) => t.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** @deprecated Prefer getProductTypes() */
export async function getCategories() {
  return getProductTypes();
}

export async function getCollectionByHandle(handle) {
  if (!handle) return null;
  const target = normalizeCollectionKey(handle);
  const collections = await getCollections();
  return (
    collections.find(
      (c) =>
        normalizeCollectionKey(c.handle) === target ||
        normalizeCollectionKey(c.slug || "") === target ||
        normalizeCollectionKey(c.name || "") === target
    ) || null
  );
}

/** Homepage collections strip: every Square collection with products (capped). */
export async function getFeaturedCollections(limit = 6) {
  const collections = await getCollections();
  return collections.slice(0, limit);
}

export async function getProductByHandle(handle) {
  const products = await getProducts();
  return products.find((p) => p.handle === handle) || null;
}

/**
 * Manually featured products (Square Featured custom attribute).
 * No silent fallback — pre-launch must not invent merchandising.
 */
export async function getFeaturedProducts(limit = 4) {
  const products = await getProducts();
  return products.filter((p) => p.featured).slice(0, limit);
}

/**
 * Real best sellers from Square order/sales data — not implemented yet.
 * Returns [] until sales exist. Do NOT fake rankings from featured/inventory.
 */
export async function getBestSellingProducts(_limit = 4) {
  return [];
}

/** Reserved for a future Square “New” attribute / catalog date sort. */
export async function getNewProducts(_limit = 4) {
  return [];
}

/** @deprecated Use getFeaturedProducts() */
export async function getFeatured(limit = 4) {
  return getFeaturedProducts(limit);
}

export async function getRelated(product, limit = 4) {
  const products = await getProducts();
  const others = products.filter((p) => p.id !== product?.id);
  if (product?.collectionHandle) {
    const sameCollection = others.filter((p) =>
      productInCollection(p, product.collectionHandle)
    );
    if (sameCollection.length) return sameCollection.slice(0, limit);
  }
  if (product?.categoryId) {
    return others.filter((p) => p.categoryId === product.categoryId).slice(0, limit);
  }
  return others.slice(0, limit);
}

export function queryProducts(
  products,
  { search = "", category = "all", collection = "all", sort = "featured" } = {}
) {
  let list = [...products];

  const term = search.trim().toLowerCase();
  if (term) {
    list = list.filter((p) =>
      [p.name, p.description, p.categoryName, p.collectionName, ...p.tags]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }

  if (collection && collection !== "all") {
    list = list.filter((p) => productInCollection(p, collection));
  }

  if (category && category !== "all") {
    list = list.filter((p) => p.categoryHandle === category);
  }

  switch (sort) {
    case "price-asc":
      list.sort((a, b) => a.minPriceCents - b.minPriceCents);
      break;
    case "price-desc":
      list.sort((a, b) => b.minPriceCents - a.minPriceCents);
      break;
    case "name-asc":
      list.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "featured":
    default:
      list.sort((a, b) => Number(b.featured) - Number(a.featured));
      break;
  }

  return list;
}

/** @deprecated kept for any leftover imports */
export function sortCollections(collections, order = []) {
  if (!order.length) {
    return [...collections].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name));
  }
  const rank = new Map(order.map((name, i) => [name, i]));
  return [...collections].sort((a, b) => {
    const ai = rank.has(a.name) ? rank.get(a.name) : Number.POSITIVE_INFINITY;
    const bi = rank.has(b.name) ? rank.get(b.name) : Number.POSITIVE_INFINITY;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}
