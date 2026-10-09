// Sitewide sale / promo — announcement bar message + sale price display.
// Config lives in Cloudflare KV via GET /api/site-promo (admin PUT).

const DEFAULT = {
  enabled: false,
  bannerMessage: "",
  promoCode: "",
  discountPercent: 0,
};

/** @type {typeof DEFAULT | null} */
let cached = null;
/** @type {Promise<typeof DEFAULT> | null} */
let pending = null;

export function normalizeSitePromo(raw = {}) {
  const discountPercent = Math.min(
    100,
    Math.max(0, Math.round(Number(raw.discountPercent) || 0))
  );
  return {
    enabled: Boolean(raw.enabled),
    bannerMessage: String(raw.bannerMessage || "").trim(),
    promoCode: String(raw.promoCode || "").trim(),
    discountPercent,
  };
}

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

export function isSalePricingActive(promo = cached) {
  return Boolean(promo?.enabled) && Number(promo?.discountPercent) > 0;
}

/** Sale price in cents (rounded). Returns original when sale is off. */
export function salePriceCents(priceCents, promo = cached) {
  const cents = Math.max(0, Math.round(Number(priceCents) || 0));
  if (!isSalePricingActive(promo)) return cents;
  const pct = Number(promo.discountPercent);
  return Math.max(0, Math.round((cents * (100 - pct)) / 100));
}

/**
 * HTML for a money amount — strikethrough original + sale when active.
 * @param {number} priceCents
 * @param {{ from?: boolean, currency?: string }} [opts]
 * @param {(cents: number, currency?: string) => string} formatMoney
 */
export function priceDisplayHTML(priceCents, opts, formatMoney) {
  const from = Boolean(opts?.from);
  const currency = opts?.currency;
  const original = Math.max(0, Math.round(Number(priceCents) || 0));
  const sale = salePriceCents(original);
  const prefix = from ? "From " : "";

  if (isSalePricingActive() && sale < original) {
    return `<span class="price price--sale">${
      from ? `<span class="price__from">From </span>` : ""
    }<s class="price__was">${formatMoney(original, currency)}</s> <span class="price__now">${formatMoney(
      sale,
      currency
    )}</span></span>`;
  }

  return `${prefix}${formatMoney(original, currency)}`;
}

export function getSitePromo() {
  return cached || DEFAULT;
}

export async function loadSitePromo({ force = false } = {}) {
  if (!force && cached) return cached;
  if (!force && pending) return pending;

  pending = fetch("/api/site-promo", { headers: { Accept: "application/json" } })
    .then(async (res) => {
      if (!res.ok) return { ...DEFAULT };
      const data = await res.json().catch(() => ({}));
      return normalizeSitePromo(data);
    })
    .catch(() => ({ ...DEFAULT }))
    .then((promo) => {
      cached = promo;
      pending = null;
      return promo;
    });

  return pending;
}

// Start fetch early so product grids usually have promo before first paint.
loadSitePromo();
