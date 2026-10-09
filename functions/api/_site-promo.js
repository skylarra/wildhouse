// Shared site promo / sale helpers for Cloudflare Pages Functions.
// Stored in COLLECTIONS_CONFIG KV under a separate key (no new binding).

export const SITE_PROMO_KV_KEY = "site-promo";

export function normalizeSitePromo(raw = {}) {
  const discountPercent = Math.min(
    100,
    Math.max(0, Math.round(Number(raw.discountPercent) || 0))
  );
  const bannerMessage = String(raw.bannerMessage || "").trim().slice(0, 200);
  const promoCode = String(raw.promoCode || "")
    .trim()
    .slice(0, 40);
  const enabled = Boolean(raw.enabled);

  return {
    enabled,
    bannerMessage,
    promoCode,
    discountPercent,
  };
}

/** Active sale pricing: enabled + percent > 0. */
export function isSalePricingActive(promo) {
  return Boolean(promo?.enabled) && Number(promo?.discountPercent) > 0;
}

/** Banner text when promo is enabled (message, or generated from % / code). */
export function promoBannerText(promo) {
  if (!promo?.enabled) return "";
  if (promo.bannerMessage) return promo.bannerMessage;
  const parts = [];
  if (promo.discountPercent > 0) {
    parts.push(`${promo.discountPercent}% off sitewide`);
  }
  if (promo.promoCode) {
    parts.push(`use code ${promo.promoCode}`);
  }
  return parts.join(" · ") || "Sale on now";
}

/** Load promo from KV (or empty default). */
export async function loadSitePromoFromEnv(env) {
  if (!env?.COLLECTIONS_CONFIG) return normalizeSitePromo({});
  try {
    const stored = await env.COLLECTIONS_CONFIG.get(SITE_PROMO_KV_KEY, "json");
    if (stored && typeof stored === "object") return normalizeSitePromo(stored);
  } catch (_) {
    /* ignore */
  }
  return normalizeSitePromo({});
}
