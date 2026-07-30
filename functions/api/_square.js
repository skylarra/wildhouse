// Shared helpers for the Square-backed Cloudflare Pages Functions.
// The access token and location come from environment variables (Cloudflare Pages
// project settings / Cursor Secrets) and NEVER touch the browser.
// Files prefixed with "_" are not routed by Cloudflare Pages, so this is import-only.

const API_VERSION_DEFAULT = "2025-01-23";

export function squareConfig(env) {
  const environment = (env.SQUARE_ENVIRONMENT || "sandbox").toLowerCase();
  const base =
    environment === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";
  return {
    base,
    environment,
    token: env.SQUARE_ACCESS_TOKEN,
    locationId: env.SQUARE_LOCATION_ID,
    version: env.SQUARE_API_VERSION || API_VERSION_DEFAULT,
    configured: Boolean(env.SQUARE_ACCESS_TOKEN && env.SQUARE_LOCATION_ID),
  };
}

/** Names only — never values — so deploy diagnostics stay safe to expose. */
export function missingSquareEnv(env = {}) {
  const missing = [];
  if (!env.SQUARE_ACCESS_TOKEN) missing.push("SQUARE_ACCESS_TOKEN");
  if (!env.SQUARE_LOCATION_ID) missing.push("SQUARE_LOCATION_ID");
  return missing;
}

function isFeaturedItem(itemData = {}) {
  // Prefer an explicit Square custom attribute named like "featured".
  const attrs = itemData.custom_attribute_values || {};
  for (const attr of Object.values(attrs)) {
    const key = String(attr?.name || attr?.key || "").toLowerCase();
    if (!key.includes("featured")) continue;
    if (attr.boolean_value === true) return true;
    if (String(attr.string_value || "").toLowerCase() === "true") return true;
  }
  return false;
}

export async function squareFetch(cfg, path, options = {}) {
  const res = await fetch(`${cfg.base}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Square-Version": cfg.version,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.errors?.[0]?.detail || res.statusText;
    throw new Error(`Square API ${res.status}: ${detail}`);
  }
  return body;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Pure transform: Square Catalog list objects + inventory counts -> the same shape
// as data/products.json, so the frontend catalog layer is source-agnostic.
// `counts` is an array of { catalog_object_id, quantity } (IN_STOCK only).
export function squareToCatalog(objects = [], counts = [], currency = "USD") {
  const categories = [];
  const images = {};
  const inventory = {};
  const items = [];

  for (const obj of objects) {
    if (obj.type === "CATEGORY") {
      const name = obj.category_data?.name || "Uncategorized";
      const imageIds = obj.category_data?.image_ids || [];
      categories.push({
        id: obj.id,
        type: "CATEGORY",
        category_data: {
          name,
          handle: slugify(name),
          // Square may attach images to categories; first id wins as cover.
          image_ids: imageIds,
          image_id: imageIds[0] || null,
        },
      });
    } else if (obj.type === "IMAGE") {
      if (obj.image_data?.url) images[obj.id] = { url: obj.image_data.url };
    } else if (obj.type === "ITEM") {
      items.push(obj);
    }
  }

  for (const c of counts) {
    inventory[c.catalog_object_id] =
      (inventory[c.catalog_object_id] || 0) + Number(c.quantity || 0);
  }

  const objectsOut = items.map((it) => {
    const d = it.item_data || {};
    // Square exposes an item's category as either `categories[]` (newer) or
    // `category_id` (older); support both.
    const categoryId = d.categories?.[0]?.id || d.category_id || null;
    return {
      type: "ITEM",
      id: it.id,
      item_data: {
        name: d.name,
        description: d.description || "",
        category_id: categoryId,
        image_ids: d.image_ids || [],
        variations: (d.variations || []).map((v) => ({
          type: "ITEM_VARIATION",
          id: v.id,
          item_variation_data: {
            item_id: it.id,
            name: v.item_variation_data?.name,
            sku: v.item_variation_data?.sku,
            pricing_type: v.item_variation_data?.pricing_type || "FIXED_PRICING",
            price_money: v.item_variation_data?.price_money || { amount: 0, currency },
          },
        })),
      },
      custom: {
        handle: slugify(d.name) || it.id,
        tags: [],
        // Square has no native featured flag; map a "featured" custom attribute
        // when present. Frontend also falls back to in-stock items.
        featured: isFeaturedItem(d),
      },
    };
  });

  return { currency, categories, images, inventory, objects: objectsOut };
}
