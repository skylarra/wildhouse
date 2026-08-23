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

function isFeaturedItem(attrs = {}) {
  for (const attr of Object.values(attrs)) {
    const key = String(attr?.name || attr?.key || "").toLowerCase();
    if (!key.includes("featured")) continue;
    if (attr.boolean_value === true) return true;
    if (String(attr.string_value || "").toLowerCase() === "true") return true;
  }
  return false;
}

/** True when a Square custom attribute is the Collection membership field. */
function isCollectionAttribute(attr = {}) {
  const name = String(attr.name || "").trim().toLowerCase();
  const key = String(attr.key || "").trim().toLowerCase();
  return (
    name === "collection" ||
    key === "collection" ||
    key.endsWith(":collection") ||
    key.endsWith(".collection")
  );
}

/**
 * Read Collection custom-attribute values from a catalog item.
 * Supports STRING attributes and SELECTION attributes (via UID → name map).
 * Returns an ordered, deduped list of display names exactly as in Square.
 * Structured as an array so multi-value Collection attrs can be adopted later.
 */
export function readCollectionNames(customAttributeValues = {}, selectionNameByUid = new Map()) {
  const names = [];
  for (const attr of Object.values(customAttributeValues || {})) {
    if (!isCollectionAttribute(attr)) continue;

    const stringVal = String(attr.string_value || "").trim();
    if (stringVal) names.push(stringVal);

    for (const uid of attr.selection_uid_values || []) {
      const label = selectionNameByUid.get(uid);
      if (label) names.push(label);
    }
  }
  return [...new Set(names)];
}

/** Build selection UID → display name from CUSTOM_ATTRIBUTE_DEFINITION objects. */
export function buildSelectionNameMap(objects = []) {
  const map = new Map();
  for (const obj of objects) {
    if (obj.type !== "CUSTOM_ATTRIBUTE_DEFINITION") continue;
    const data = obj.custom_attribute_definition_data || {};
    const selections = data.selection_config?.allowed_selections || [];
    for (const sel of selections) {
      if (sel?.uid && sel?.name) map.set(sel.uid, sel.name);
    }
  }
  return map;
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
    headers: {
      "Content-Type": "application/json",
      // Short browser/CDN cache so Square edits appear soon without hammering the API.
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
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
//
// Architecture:
// - Square Categories → product type (reporting / type filters)
// - Square custom attribute "Collection" → customer-facing collection membership
export function squareToCatalog(objects = [], counts = [], currency = "USD") {
  const categories = [];
  const images = {};
  const inventory = {};
  const items = [];
  const selectionNameByUid = buildSelectionNameMap(objects);

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
          image_ids: imageIds,
          image_id: imageIds[0] || null,
        },
      });
    } else if (obj.type === "IMAGE") {
      if (obj.image_data?.url) images[obj.id] = { url: obj.image_data.url };
    } else if (obj.type === "ITEM") {
      // Skip intentionally archived/deleted catalog items.
      if (obj.is_deleted) continue;
      if (obj.item_data?.is_archived) continue;
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
    // `category_id` (older); support both. This is PRODUCT TYPE, not collection.
    const categoryId = d.categories?.[0]?.id || d.category_id || null;

    // Collection membership: custom attribute on the CatalogObject and/or item_data.
    const attrs = {
      ...(it.custom_attribute_values || {}),
      ...(d.custom_attribute_values || {}),
    };
    const collectionNames = readCollectionNames(attrs, selectionNameByUid);
    const primaryCollection = collectionNames[0] || null;

    return {
      type: "ITEM",
      id: it.id,
      item_data: {
        name: d.name,
        description: d.description_plaintext || d.description || "",
        description_html: d.description_html || "",
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
            image_ids: v.item_variation_data?.image_ids || v.image_ids || [],
          },
        })),
      },
      custom: {
        handle: slugify(d.name) || it.id,
        tags: [],
        featured: isFeaturedItem(attrs),
        // Exact Square Collection display name(s). Membership authority.
        collection: primaryCollection,
        collections: collectionNames,
      },
    };
  });

  return { currency, categories, images, inventory, objects: objectsOut };
}
