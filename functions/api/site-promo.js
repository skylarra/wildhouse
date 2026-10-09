// GET/PUT /api/site-promo
// Sitewide sale / promo for the top announcement bar + storefront sale prices.
// - GET: public (storefront + admin)
// - PUT: Authorization: Bearer <ADMIN_PASSWORD>; writes to COLLECTIONS_CONFIG KV
import { json } from "./_square.js";
import { checkAdmin } from "./_admin-auth.js";
import {
  SITE_PROMO_KV_KEY,
  normalizeSitePromo,
  promoBannerText,
  isSalePricingActive,
  loadSitePromoFromEnv,
} from "./_site-promo.js";

async function loadPromo(env) {
  const promo = await loadSitePromoFromEnv(env);
  return {
    ...promo,
    bannerPreview: promoBannerText(promo),
    salePricingActive: isSalePricingActive(promo),
    _meta: {
      source: env.COLLECTIONS_CONFIG ? "kv" : "default",
      kvConfigured: Boolean(env.COLLECTIONS_CONFIG),
      adminConfigured: Boolean(env.ADMIN_PASSWORD),
    },
  };
}

export async function onRequestGet({ env }) {
  return json(await loadPromo(env));
}

export async function onRequestPut({ request, env }) {
  const auth = checkAdmin(request, env);
  if (!auth.ok) {
    if (auth.reason === "ADMIN_PASSWORD not configured") {
      return json(
        {
          error: "Admin writes require ADMIN_PASSWORD and COLLECTIONS_CONFIG KV binding.",
          hint: "Set ADMIN_PASSWORD in Cloudflare Pages env and bind a KV namespace as COLLECTIONS_CONFIG.",
        },
        503
      );
    }
    return json({ error: "Unauthorized" }, 401);
  }

  if (!env.COLLECTIONS_CONFIG) {
    return json(
      {
        error: "COLLECTIONS_CONFIG KV binding is not configured.",
        hint: "Add a KV namespace binding named COLLECTIONS_CONFIG in Cloudflare Pages → Settings → Functions.",
      },
      503
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const promo = normalizeSitePromo(body);
  if (promo.enabled && !promoBannerText(promo)) {
    return json(
      {
        error: "Add a banner message, discount percent, or promo code before enabling.",
      },
      400
    );
  }

  await env.COLLECTIONS_CONFIG.put(SITE_PROMO_KV_KEY, JSON.stringify(promo));
  return json({
    ...promo,
    bannerPreview: promoBannerText(promo),
    salePricingActive: isSalePricingActive(promo),
    _meta: { source: "kv", saved: true, kvConfigured: true },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, PUT, OPTIONS",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}
