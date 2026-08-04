// Wildhouse Lane — catalog access layer.
// Loads the live Square catalog (via /api/catalog) or falls back to
// data/products.json. Pages depend on the normalized product/collection
// helpers below — never hardcode Square category names in the UI.

import { loadSite, loadJSON } from "./content.js";

let cache = null;
let collectionsMetaCache = null;

const DEFAULT_COLLECTION_IMAGE = "./assets/Wildhouse.png";

export function formatMoney(cents, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    (cents || 0) / 100
  );
}

async function loadRaw() {
  if (cache) return cache;
  // Prefer the live Square catalog (served by the Cloudflare Function at
  // /api/catalog). Fall back to the bundled products.json when Square isn't
  // configured, errors, or returns an empty catalog so the shop never goes blank.
  try {
    const live = await fetch("./api/catalog", { cache: "no-store" });
    if (live.ok) {
      const data = await live.json();
      if (Array.isArray(data?.objects) && data.objects.length > 0) {
        cache = data;
        return cache;
      }
    }
  } catch (_) {
    /* network/offline or static host without Functions — use local fallback */
  }
  const res = await fetch("./data/products.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load catalog: ${res.status}`);
  cache = await res.json();
  return cache;
}

async function loadCollectionsMeta() {
  if (collectionsMetaCache) return collectionsMetaCache;
  try {
    collectionsMetaCache = await loadJSON("./content/collections.json");
  } catch (_) {
    collectionsMetaCache = { order: [], entries: [] };
  }
  return collectionsMetaCache;
}

/** Index storytelling metadata by Square category name and handle. */
function metaIndex(meta) {
  const byName = new Map();
  const byHandle = new Map();
  for (const entry of meta.entries || []) {
    if (entry.name) byName.set(entry.name, entry);
    if (entry.handle) byHandle.set(entry.handle, entry);
  }
  return { byName, byHandle };
}

function enrichCollection(base, metaMaps) {
  const entry =
    metaMaps.byHandle.get(base.handle) || metaMaps.byName.get(base.name) || null;
  return {
    ...base,
    description: entry?.description || "",
    heroImage: entry?.heroImage || base.image,
    featured: Boolean(entry?.featured),
  };
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
      return {
        id: obj.id,
        name: d.name,
        description: d.description || "",
        handle: obj.custom?.handle || obj.id,
        tags: obj.custom?.tags || [],
        featured: Boolean(obj.custom?.featured),
        // Optional map of color/option label → image URL (local catalog or content overlay).
        colorImages: obj.custom?.colorImages || {},
        // Products without a Square category only appear under All Products.
        categoryId: d.category_id || null,
        categoryName: category?.name || "",
        categoryHandle: category?.handle || null,
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

export async function getCategories() {
  const collections = await getCollections();
  return collections.map(({ id, name, handle }) => ({ id, name, handle }));
}

/**
 * Sort collections: names listed in `order` first (exact match), then any
 * remaining collections alphabetically. Unknown order entries are ignored.
 */
export function sortCollections(collections, order = []) {
  if (!order.length) {
    return [...collections].sort((a, b) => a.name.localeCompare(b.name));
  }
  const rank = new Map(order.map((name, i) => [name, i]));
  return [...collections].sort((a, b) => {
    const ai = rank.has(a.name) ? rank.get(a.name) : Number.POSITIVE_INFINITY;
    const bi = rank.has(b.name) ? rank.get(b.name) : Number.POSITIVE_INFINITY;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Dynamic storefront collections derived from Square categories.
 * - One collection per category that has at least one product
 * - Cover/hero: content override → category image → first product image → placeholder
 * - Description + featured flags from content/collections.json
 * - Display order from collections.json → order (fallback: site.json collectionOrder)
 */
export async function getCollections() {
  const [raw, products, meta] = await Promise.all([
    loadRaw(),
    getProducts(),
    loadCollectionsMeta(),
  ]);
  const images = raw.images || {};
  const maps = metaIndex(meta);

  const counts = new Map();
  const firstImage = new Map();
  for (const p of products) {
    if (!p.categoryId) continue;
    counts.set(p.categoryId, (counts.get(p.categoryId) || 0) + 1);
    if (!firstImage.has(p.categoryId) && p.images.length) {
      firstImage.set(p.categoryId, p.images[0]);
    }
  }

  const collections = (raw.categories || [])
    .map((c) => {
      const data = c.category_data || {};
      const count = counts.get(c.id) || 0;
      const imageId = data.image_id || data.image_ids?.[0] || null;
      const categoryImage = imageId ? images[imageId]?.url : null;
      const cover = categoryImage || firstImage.get(c.id) || DEFAULT_COLLECTION_IMAGE;
      return enrichCollection(
        {
          id: c.id,
          name: data.name || "Collection",
          handle: data.handle || c.id,
          count,
          image: cover,
        },
        maps
      );
    })
    .filter((c) => c.count > 0);

  let order = Array.isArray(meta.order) ? meta.order : [];
  if (!order.length) {
    try {
      const site = await loadSite();
      order = Array.isArray(site.collectionOrder) ? site.collectionOrder : [];
    } catch (_) {
      /* optional */
    }
  }

  return sortCollections(collections, order);
}

export async function getCollectionByHandle(handle) {
  if (!handle) return null;
  const collections = await getCollections();
  return collections.find((c) => c.handle === handle) || null;
}

/** Homepage featured collections: explicit featured flags first, then ordered list. */
export async function getFeaturedCollections(limit = 6) {
  const collections = await getCollections();
  const flagged = collections.filter((c) => c.featured);
  const list = flagged.length ? flagged : collections;
  return list.slice(0, limit);
}

export async function getProductByHandle(handle) {
  const products = await getProducts();
  return products.find((p) => p.handle === handle) || null;
}

export async function getFeatured(limit = 4) {
  const products = await getProducts();
  const featured = products.filter((p) => p.featured);
  if (featured.length) return featured.slice(0, limit);
  // Live Square catalogs may not mark featured items yet — prefer in-stock.
  const inStock = products.filter((p) => p.inStock);
  return (inStock.length ? inStock : products).slice(0, limit);
}

export async function getRelated(product, limit = 4) {
  const products = await getProducts();
  if (!product?.categoryId) {
    return products.filter((p) => p.id !== product.id).slice(0, limit);
  }
  return products
    .filter((p) => p.id !== product.id && p.categoryId === product.categoryId)
    .slice(0, limit);
}

// Client-side search + filter + sort for the shop page.
export function queryProducts(products, { search = "", category = "all", sort = "featured" } = {}) {
  let list = [...products];

  const term = search.trim().toLowerCase();
  if (term) {
    list = list.filter((p) =>
      [p.name, p.description, p.categoryName, ...p.tags]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
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
