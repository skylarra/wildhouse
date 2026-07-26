// Wildhouse Lane — catalog access layer.
// Loads the local products.json (Square Catalog API shape) and normalizes it into
// a simpler product model for the UI. When Square is connected later, only this
// file needs to change; page code depends on the normalized shape below.

let cache = null;

export function formatMoney(cents, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    (cents || 0) / 100
  );
}

async function loadRaw() {
  if (cache) return cache;
  // Prefer the live Square catalog (served by the Cloudflare Function at
  // /api/catalog). Fall back to the bundled products.json when Square isn't
  // configured or during local/static preview. Both return the same shape.
  try {
    const live = await fetch("./api/catalog", { cache: "no-store" });
    if (live.ok) {
      cache = await live.json();
      return cache;
    }
  } catch (_) {
    /* network/offline or static host without Functions — use local fallback */
  }
  const res = await fetch("./data/products.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load catalog: ${res.status}`);
  cache = await res.json();
  return cache;
}

function normalize(raw) {
  const catById = new Map(raw.categories.map((c) => [c.id, c.category_data]));
  const inventory = raw.inventory || {};
  const images = raw.images || {};

  return raw.objects
    .filter((o) => o.type === "ITEM")
    .map((obj) => {
      const d = obj.item_data;
      const category = catById.get(d.category_id) || { name: "Uncategorized", handle: "uncategorized" };
      const variations = (d.variations || []).map((v) => {
        const vd = v.item_variation_data;
        return {
          id: v.id,
          name: vd.name,
          sku: vd.sku,
          priceCents: vd.price_money.amount,
          currency: vd.price_money.currency,
          stock: inventory[v.id] ?? 0,
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
        categoryId: d.category_id,
        categoryName: category.name,
        categoryHandle: category.handle,
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
  const raw = await loadRaw();
  return raw.categories.map((c) => ({ id: c.id, ...c.category_data }));
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
