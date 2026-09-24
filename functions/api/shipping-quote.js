// POST /api/shipping-quote
// Body: { fulfillment?: "ship"|"pickup", items: [{ variationId, name?, categoryHandle?, categoryName? }] }
// Returns the Wildhouse Lane flat shipping tier + fee for the cart (from env rates).
// Does NOT claim live carrier rates — Payment Links only support flat shipping_fee.
import { squareConfig, json } from "./_square.js";
import { quoteShipping, shippingFeesFromEnv } from "./_shipping.js";

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const fulfillment = String(payload?.fulfillment || "ship").toLowerCase() === "pickup" ? "pickup" : "ship";
  const items = Array.isArray(payload?.items) ? payload.items : [];

  const cfg = squareConfig(env);
  try {
    const quote = await quoteShipping({
      env,
      cfg: cfg.configured ? cfg : null,
      fulfillment,
      items: items.map((i) => ({
        variationId: i?.variationId || i?.catalogVariationId || null,
        name: i?.name || "",
        categoryName: i?.categoryName || "",
        categoryHandle: i?.categoryHandle || "",
      })),
    });

    return json({
      ok: true,
      fulfillment,
      tier: quote.tier,
      label: quote.label,
      feeCents: quote.feeCents,
      // Public rate card (not secrets) so the cart can explain tiers if needed.
      rates: {
        letterCents: quote.fees.letterCents,
        standardCents: quote.fees.standardCents,
        largeCents: quote.fees.largeCents,
        pickupCents: 0,
      },
      // Honest: these are Wildhouse Lane flat rates applied via Square Payment Links.
      rateSource: "wildhouse_flat",
    });
  } catch (err) {
    console.error("shipping-quote failed", String(err?.message || err));
    // Still return configured rate card so the UI can show something useful.
    const fees = shippingFeesFromEnv(env);
    return json(
      {
        error: "We couldn't estimate shipping right now.",
        rates: {
          letterCents: fees.letterCents,
          standardCents: fees.standardCents,
          largeCents: fees.largeCents,
          pickupCents: 0,
        },
      },
      502
    );
  }
}

export async function onRequestGet({ env }) {
  // Public rate card only (no cart classification). Fees come from Cloudflare env.
  const fees = shippingFeesFromEnv(env);
  return json({
    rates: {
      letterCents: fees.letterCents,
      standardCents: fees.standardCents,
      largeCents: fees.largeCents,
      pickupCents: 0,
    },
    rateSource: "wildhouse_flat",
  });
}
