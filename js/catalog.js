// Wildhouse Lane — catalog access layer.
// Loads the live Square catalog (via /api/catalog) or falls back to
// data/products.json.
//
// Architecture (do not invert):
// - Square `Collection` custom attribute → customer-facing collection membership
// - Square Categories → product type (shop filters / collection type chips)
// - content/collections.json → presentation only (copy, hero, featured, order)

import { loadSite, loadJSON } from "./content.js";

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

/** Index storytelling metadata by Collection display name and slug. */
function metaIndex(meta) {
  const byName = new Map();
  const byHandle = new Map();
  for (const entry of meta.entries || []) {
    if (entry.name) byName.set(entry.name, entry);
    const handle = entry.handle || (entry.name ? slugify(entry.name) : null);
    if (handle) byHandle.set(handle, entry);
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

      // Collection membership from Square custom attribute (via API transform or local JSON).
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
        // Product type = Square Category (separate from Collection).
        categoryId: d.category_id || null,
        categoryName: category?.name || "",
        categoryHandle: category?.handle || null,
        // Customer-facing collection = Square Collection attribute.
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
 * Sort collections: names listed in `order` first (exact Square display-name match),
 * then remaining alphabetically. Unknown order entries are ignored.
 * Ready for a future manual ordering system (content/collections.json → order).
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
 * Customer-facing collections derived from the Square `Collection` custom attribute.
 * - One collection per unique attribute value that has ≥1 active product
 * - Products without Collection still appear in Shop, never invent a public “Uncategorized”
 * - Cover/hero: content override → first product image → placeholder
 * - Description + featured + order from content/collections.json (presentation only)
 */
export async function getCollections() {
  const [products, meta] = await Promise.all([getProducts(), loadCollectionsMeta()]);
  const maps = metaIndex(meta);

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

  const collections = [...counts.entries()].map(([handle, count]) => {
    const name = names.get(handle);
    const cover = firstImage.get(handle) || DEFAULT_COLLECTION_IMAGE;
    return enrichCollection(
      {
        id: handle,
        name,
        handle,
        slug: handle,
        count,
        productCount: count,
        image: cover,
      },
      maps
    );
  });

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

/**
 * Product types from Square Categories (not collections).
 * Used by Shop sidebar and collection-page type filters.
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

/** @deprecated Prefer getProductTypes(); kept for older call sites. */
export async function getCategories() {
  return getProductTypes();
}

export async function getCollectionByHandle(handle) {
  if (!handle) return null;
  const collections = await getCollections();
  return collections.find((c) => c.handle === handle || c.slug === handle) || null;
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

/**
 * Client-side search + filter + sort.
 * - `collection` → Square Collection attribute slug
 * - `category` → Square Category (product type) handle
 */
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
