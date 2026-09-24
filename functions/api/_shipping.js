// Wildhouse Lane flat shipping tiers for Square Payment Links.
// These are merchant-configured customer-facing rates — NOT live USPS/carrier quotes.
//
// Env (Cloudflare Pages):
//   LETTER_SHIPPING_FEE_CENTS      — sticker-only letter mail (required for letter tier)
//   STANDARD_SHIPPING_FEE_CENTS    — default package rate (default 699 = $6.99)
//   LARGE_SHIPPING_FEE_CENTS       — shirts / wall decor (default 1099 = $10.99)
//
// Classification (ship only; pickup is always $0):
//   1. every item is sticker / mini sticker sheet  → letter
//   2. any item is shirt or wall decor / mirror    → large
//   3. otherwise                                  → standard

import { squareFetch } from "./_square.js";

export const DEFAULT_STANDARD_SHIPPING_FEE_CENTS = 699;
export const DEFAULT_LARGE_SHIPPING_FEE_CENTS = 1099;
/** Interim letter default until LETTER_SHIPPING_FEE_CENTS is set in Cloudflare. */
export const DEFAULT_LETTER_SHIPPING_FEE_CENTS = 99;

const TIER_LABELS = {
  pickup: "Local Pickup",
  letter: "Letter Mail",
  standard: "Standard Shipping",
  large: "Large Item Shipping",
};

function envCents(env, key, fallback) {
  const n = parseInt(env?.[key], 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function shippingFeesFromEnv(env = {}) {
  return {
    letterCents: envCents(env, "LETTER_SHIPPING_FEE_CENTS", DEFAULT_LETTER_SHIPPING_FEE_CENTS),
    standardCents: envCents(env, "STANDARD_SHIPPING_FEE_CENTS", DEFAULT_STANDARD_SHIPPING_FEE_CENTS),
    largeCents: envCents(env, "LARGE_SHIPPING_FEE_CENTS", DEFAULT_LARGE_SHIPPING_FEE_CENTS),
  };
}

/**
 * Classify one product into letter | large | standard using Square category + name.
 * Handles common Wildhouse Lane types: Stickers, T-Shirts, Suncatchers/mirrors, etc.
 */
export function classifyProductShippingClass({ name = "", categoryName = "", categoryHandle = "" } = {}) {
  const blob = `${categoryHandle} ${categoryName} ${name}`.toLowerCase();

  // Letter: stickers / mini sticker sheets only
  if (
    /\bstickers?\b/.test(blob) ||
    /\bmini\s*sticker/.test(blob) ||
    /\bsticker\s*sheet/.test(blob) ||
    categoryHandle === "stickers"
  ) {
    return "letter";
  }

  // Large: shirts, wall mirrors / wall decor / suncatchers
  if (
    /\bt-?shirts?\b/.test(blob) ||
    /\btees?\b/.test(blob) ||
    /\bshirts?\b/.test(blob) ||
    categoryHandle === "t-shirts" ||
    categoryHandle === "tshirts" ||
    categoryHandle === "shirts"
  ) {
    return "large";
  }
  if (
    /\bmirrors?\b/.test(blob) ||
    /\bwall\s*decor/.test(blob) ||
    /\bwall\s*hang/.test(blob) ||
    /\bsuncatchers?\b/.test(blob) ||
    categoryHandle === "suncatchers" ||
    categoryHandle === "mirrors" ||
    categoryHandle === "wall-decor"
  ) {
    return "large";
  }

  // Standard: magnets, keychains, patches, and other small packaged goods
  return "standard";
}

/**
 * Resolve cart-level shipping tier from per-item classes + fulfillment.
 * Priority: pickup → all letter → any large → standard.
 */
export function resolveShippingTier(itemClasses = [], fulfillment = "ship") {
  if (fulfillment === "pickup") return "pickup";
  const classes = (itemClasses || []).filter(Boolean);
  if (!classes.length) return "standard";
  if (classes.every((c) => c === "letter")) return "letter";
  if (classes.some((c) => c === "large")) return "large";
  return "standard";
}

export function shippingLabelForTier(tier) {
  return TIER_LABELS[tier] || TIER_LABELS.standard;
}

export function feeCentsForTier(tier, env = {}) {
  const fees = shippingFeesFromEnv(env);
  if (tier === "pickup") return 0;
  if (tier === "letter") return fees.letterCents;
  if (tier === "large") return fees.largeCents;
  return fees.standardCents;
}

export function quoteFromClasses(itemClasses, fulfillment, env = {}) {
  const tier = resolveShippingTier(itemClasses, fulfillment);
  const feeCents = feeCentsForTier(tier, env);
  return {
    tier,
    label: shippingLabelForTier(tier),
    feeCents,
    fees: shippingFeesFromEnv(env),
  };
}

/**
 * Load Square catalog context for variation IDs and return per-variation product info
 * used for shipping classification (name + category).
 */
export async function loadShippingCatalogHints(cfg, variationIds = []) {
  const ids = [...new Set(variationIds.filter(Boolean))];
  if (!ids.length) return new Map();

  const res = await squareFetch(cfg, "/v2/catalog/batch-retrieve", {
    method: "POST",
    body: JSON.stringify({
      object_ids: ids,
      include_related_objects: true,
    }),
  });

  const objects = [...(res.objects || []), ...(res.related_objects || [])];
  const byId = new Map(objects.map((o) => [o.id, o]));

  const categoryName = (item) => {
    const d = item?.item_data || {};
    const catId = d.categories?.[0]?.id || d.category_id || null;
    if (!catId) return { categoryName: "", categoryHandle: "" };
    const cat = byId.get(catId);
    const name = cat?.category_data?.name || "";
    const handle = String(name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return { categoryName: name, categoryHandle: handle };
  };

  const hints = new Map();
  for (const id of ids) {
    const variation = byId.get(id);
    if (!variation || variation.type !== "ITEM_VARIATION") {
      hints.set(id, { name: "", categoryName: "", categoryHandle: "" });
      continue;
    }
    const itemId = variation.item_variation_data?.item_id;
    const item = itemId ? byId.get(itemId) : null;
    const name = item?.item_data?.name || variation.item_variation_data?.name || "";
    const cats = categoryName(item);
    hints.set(id, { name, ...cats });
  }
  return hints;
}

/**
 * Build a shipping quote for checkout/cart.
 * Prefers Square catalog classification when cfg is configured; otherwise uses
 * optional client hints (name / categoryHandle) per line.
 */
export async function quoteShipping({
  env,
  cfg,
  fulfillment = "ship",
  items = [],
}) {
  const fulfill = fulfillment === "pickup" ? "pickup" : "ship";
  if (fulfill === "pickup") {
    return quoteFromClasses([], "pickup", env);
  }

  const variationIds = items.map((i) => i.variationId || i.catalog_object_id).filter(Boolean);
  let hints = new Map();

  if (cfg?.configured && variationIds.length) {
    try {
      hints = await loadShippingCatalogHints(cfg, variationIds);
    } catch (err) {
      console.error("shipping catalog lookup failed", String(err?.message || err));
    }
  }

  const classes = items.map((item) => {
    const id = item.variationId || item.catalog_object_id;
    const fromSquare = id ? hints.get(id) : null;
    return classifyProductShippingClass({
      name: fromSquare?.name || item.name || "",
      categoryName: fromSquare?.categoryName || item.categoryName || "",
      categoryHandle: fromSquare?.categoryHandle || item.categoryHandle || "",
    });
  });

  return quoteFromClasses(classes, fulfill, env);
}
