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

/**
 * Index CUSTOM_ATTRIBUTE_DEFINITION objects by id.
 * Square value payloads often omit `name`/`key`; the map key on the item plus
 * the definition id are the reliable identifiers.
 */
export function buildAttributeDefinitionIndex(objects = []) {
  const byId = new Map();
  for (const obj of objects) {
    if (obj.type !== "CUSTOM_ATTRIBUTE_DEFINITION") continue;
    const data = obj.custom_attribute_definition_data || {};
    byId.set(obj.id, {
      id: obj.id,
      name: String(data.name || "").trim(),
      key: String(data.key || "").trim(),
      type: String(data.type || "").trim().toUpperCase(),
      allowedSelections: data.selection_config?.allowed_selections || [],
    });
  }
  return byId;
}

/** Lowercased identity strings for a custom-attribute value (map key, value fields, definition). */
export function attributeIdentities(mapKey, attr = {}, defIndex = new Map()) {
  const out = [];
  const push = (v) => {
    const s = String(v || "")
      .trim()
      .toLowerCase();
    if (s && !out.includes(s)) out.push(s);
  };
  push(mapKey);
  push(attr.name);
  push(attr.key);
  const def = attr.custom_attribute_definition_id
    ? defIndex.get(attr.custom_attribute_definition_id)
    : null;
  if (def) {
    push(def.name);
    push(def.key);
  }
  return out;
}

function identityMatches(identities, needle) {
  const n = String(needle || "")
    .trim()
    .toLowerCase();
  if (!n) return false;
  return identities.some(
    (id) =>
      id === n ||
      id.endsWith(`:${n}`) ||
      id.endsWith(`.${n}`) ||
      id.endsWith(`_${n}`)
  );
}

function isFeaturedIdentity(identities) {
  return identityMatches(identities, "featured");
}

function isCollectionIdentity(identities) {
  return identityMatches(identities, "collection");
}

function isTruthyLabel(label) {
  const s = String(label || "")
    .trim()
    .toLowerCase();
  if (!s) return false;
  if (s === "false" || s === "no" || s === "off" || s === "0" || s === "none") return false;
  return true;
}

/** True when a Featured custom attribute value is ON. */
function featuredValueIsOn(attr = {}, defIndex = new Map()) {
  if (attr.boolean_value === true) return true;
  if (attr.boolean_value === false) return false;

  const str = String(attr.string_value || "")
    .trim()
    .toLowerCase();
  if (str === "true" || str === "yes" || str === "1") return true;
  if (str === "false" || str === "no" || str === "0") return false;

  // SELECTION-style Featured (Yes/No): resolve labels so "No" is not treated as on.
  if (Array.isArray(attr.selection_uid_values) && attr.selection_uid_values.length) {
    const def = attr.custom_attribute_definition_id
      ? defIndex.get(attr.custom_attribute_definition_id)
      : null;
    const byUid = new Map(
      (def?.allowedSelections || []).map((sel) => [sel.uid, sel.name])
    );
    const labels = attr.selection_uid_values
      .map((uid) => byUid.get(uid) || "")
      .filter(Boolean);
    if (labels.length) return labels.some(isTruthyLabel);
    // Unknown labels — presence of a selection still means the merchant opted in.
    return true;
  }

  // Some merchants store 1/0 as NUMBER.
  if (attr.number_value != null && String(attr.number_value).trim() !== "") {
    const num = Number(attr.number_value);
    if (Number.isFinite(num)) return num !== 0;
  }

  return false;
}

/**
 * Merge custom_attribute_values from the CatalogObject, item_data, and
 * item variations (Featured/Collection may be allowed on ITEM_VARIATION).
 * Later sources do not overwrite earlier keys; variation attrs fill gaps.
 */
export function collectItemAttributeValues(item = {}) {
  const merged = {};
  const layers = [item.custom_attribute_values, item.item_data?.custom_attribute_values];
  for (const layer of layers) {
    if (!layer || typeof layer !== "object") continue;
    for (const [k, v] of Object.entries(layer)) {
      if (!(k in merged)) merged[k] = v;
    }
  }
  for (const variation of item.item_data?.variations || []) {
    for (const layer of [variation.custom_attribute_values, variation.item_variation_data?.custom_attribute_values]) {
      if (!layer || typeof layer !== "object") continue;
      for (const [k, v] of Object.entries(layer)) {
        if (!(k in merged)) merged[k] = v;
      }
    }
  }
  return merged;
}

export function isFeaturedItem(attrs = {}, defIndex = new Map()) {
  for (const [mapKey, attr] of Object.entries(attrs || {})) {
    const identities = attributeIdentities(mapKey, attr, defIndex);
    if (!isFeaturedIdentity(identities)) continue;
    if (featuredValueIsOn(attr, defIndex)) return true;
  }
  return false;
}

/** True when a Square custom attribute is the Collection membership field. */
export function isCollectionAttribute(mapKey, attr = {}, defIndex = new Map()) {
  return isCollectionIdentity(attributeIdentities(mapKey, attr, defIndex));
}

/**
 * Read Collection custom-attribute values from a catalog item.
 * Supports STRING attributes and SELECTION attributes (via UID → name map).
 * Uses the custom_attribute_values map key and definition metadata — Square
 * often omits `name` on the value object itself.
 */
export function readCollectionNames(
  customAttributeValues = {},
  selectionNameByUid = new Map(),
  defIndex = new Map()
) {
  const names = [];
  for (const [mapKey, attr] of Object.entries(customAttributeValues || {})) {
    if (!isCollectionAttribute(mapKey, attr, defIndex)) continue;

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

/**
 * Every allowed selection name on the Square "Collection" attribute definition.
 * Lets admin/collections list all Square options even before products are assigned.
 */
export function listCollectionOptionNames(objects = [], defIndex = null) {
  const index = defIndex || buildAttributeDefinitionIndex(objects);
  const names = [];
  for (const def of index.values()) {
    const identities = [def.name, def.key]
      .map((s) => String(s || "").trim().toLowerCase())
      .filter(Boolean);
    if (!isCollectionIdentity(identities)) continue;
    for (const sel of def.allowedSelections || []) {
      const label = String(sel?.name || "").trim();
      if (label) names.push(label);
    }
  }
  return [...new Set(names)];
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

/**
 * Paginate Square Catalog List — a single page can omit CUSTOM_ATTRIBUTE_DEFINITION
 * objects needed to resolve Collection selection UIDs and Featured keys.
 */
export async function listCatalogObjects(cfg, types = "ITEM,CATEGORY,IMAGE,CUSTOM_ATTRIBUTE_DEFINITION") {
  const objects = [];
  let cursor = null;
  do {
    const qs = new URLSearchParams({ types });
    if (cursor) qs.set("cursor", cursor);
    const page = await squareFetch(cfg, `/v2/catalog/list?${qs}`);
    objects.push(...(page.objects || []));
    cursor = page.cursor || null;
  } while (cursor);
  return objects;
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
// - Square custom attribute "Featured" → product.featured (manual merchandising)
export function squareToCatalog(objects = [], counts = [], currency = "USD") {
  const categories = [];
  const images = {};
  const inventory = {};
  const items = [];
  const defIndex = buildAttributeDefinitionIndex(objects);
  const selectionNameByUid = buildSelectionNameMap(objects);
  const collectionOptions = listCollectionOptionNames(objects, defIndex);

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

    const attrs = collectItemAttributeValues(it);
    const collectionNames = readCollectionNames(attrs, selectionNameByUid, defIndex);
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
        featured: isFeaturedItem(attrs, defIndex),
        // Exact Square Collection display name(s). Membership authority.
        collection: primaryCollection,
        collections: collectionNames,
      },
    };
  });

  return {
    currency,
    categories,
    images,
    inventory,
    objects: objectsOut,
    // All Collection selection labels from Square (for admin detection).
    collectionOptions,
  };
}
