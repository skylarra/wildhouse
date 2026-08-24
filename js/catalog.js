// Wildhouse Lane — catalog access layer.
// Loads the live Square catalog (via /api/catalog) or falls back to
// data/products.json.
//
// Architecture (do not invert):
// - Square `Collection` custom attribute → product membership
// - Square Categories → product type (shop filters / collection type chips)
// - Website collections config → visibility, featured, order, copy, images
//   (content/collections.json seed + /api/collections-config KV override)

import { loadJSON, sitePath } from "./content.js";
import {
  normalizeCollectionsConfig,
  mergeCollectionsWithConfig,
  isPublicCollection,
  COLLECTIONS_CONFIG_LS_KEY,
} from "./collections-config.js";

let cache = null;
let collectionsMetaCache = null;

const DEFAULT_COLLECTION_IMAGE = "./assets/coming-soon.png";

export function formatMoney(cents, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    (cents || 0) / 100
  );
}

/** URL slug from a Square Collection display name (display name itself is never mutated). */
export function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Pretty collection path used in production (Cloudflare `_redirects` → collection.html). */
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
 * Priority: /api/collections-config → localStorage admin draft → content/collections.json
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
    const draft = localStorage.getItem(COLLECTIONS_CONFIG_LS_KEY);
    if (draft) {
      collectionsMetaCache = normalizeCollectionsConfig(JSON.parse(draft));
      return collectionsMetaCache;
    }
  } catch (_) {
    /* private mode / invalid JSON */
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
      const collectionHandle = collectionName ? slugify(collectionName) : null;

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

/** Detect collections from Square membership only (no visibility filter). */
async function detectCollectionsFromProducts(products) {
  const counts = new Map();
  const names = new Map();
  const firstImage = new Map();

  for (const p of products) {
    if (!p.collectionHandle || !p.collectionName) continue;
    counts.set(p.collectionHandle, (counts.get(p.collectionHandle) || 0) + 1);
    names.set(p.collectionHandle, p.collectionName);
    if (!firstImage.has(p.collectionHandle) && p.images.length) {
      firstImage.set(p.collectionHandle, p.images[0]);
    }
  }

  return [...counts.entries()].map(([handle, count]) => ({
    handle,
    collectionKey: handle,
    name: names.get(handle),
    count,
    productCount: count,
    image: firstImage.get(handle) || DEFAULT_COLLECTION_IMAGE,
  }));
}

/**
 * Full collection records for admin (includes hidden + empty).
 * Public pages should use getCollections() instead.
 */
export async function getAllCollectionRecords() {
  const [products, meta] = await Promise.all([getProducts(), loadCollectionsMeta()]);
  const detected = await detectCollectionsFromProducts(products);
  return mergeCollectionsWithConfig(detected, meta).map((c) => ({
    ...c,
    image: c.image || DEFAULT_COLLECTION_IMAGE,
    heroImage: c.heroImage || c.image || DEFAULT_COLLECTION_IMAGE,
  }));
}

/**
 * Public collections: visible === true AND productCount > 0, sorted by sortOrder.
 */
export async function getCollections() {
  const all = await getAllCollectionRecords();
  return all.filter(isPublicCollection);
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
  const collections = await getCollections();
  return collections.find((c) => c.handle === handle || c.slug === handle) || null;
}

/** Homepage featured strip: public + featured only (no fallback to all). */
export async function getFeaturedCollections(limit = 6) {
  const collections = await getCollections();
  return collections.filter((c) => c.featured).slice(0, limit);
}

export async function getProductByHandle(handle) {
  const products = await getProducts();
  return products.find((p) => p.handle === handle) || null;
}

export async function getFeatured(limit = 4) {
  const products = await getProducts();
  const featured = products.filter((p) => p.featured);
  if (featured.length) return featured.slice(0, limit);
  const inStock = products.filter((p) => p.inStock);
  return (inStock.length ? inStock : products).slice(0, limit);
}

export async function getRelated(product, limit = 4) {
  const products = await getProducts();
  const others = products.filter((p) => p.id !== product?.id);
  if (product?.collectionHandle) {
    const sameCollection = others.filter(
      (p) => p.collectionHandle === product.collectionHandle
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
    list = list.filter((p) => p.collectionHandle === collection);
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
