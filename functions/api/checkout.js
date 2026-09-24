// POST /api/checkout
// Body: { items: [{ variationId, qty, note? }], fulfillment?: "ship" | "pickup" }
// Creates a Square Payment Link (Square-hosted checkout) and returns { url, orderId }.
//
// Square handles:
//   - Catalog pricing (source of truth)
//   - Sales tax via order.pricing_options.auto_apply_taxes (catalog tax rules)
//   - Shipping fee via checkout_options.shipping_fee (Wildhouse Lane flat tier on the Square order)
//   - Local pickup via order.fulfillments type PICKUP
//
// Honest limitation: Payment Links do NOT return address-based carrier rates.
// Shipping is a Wildhouse Lane flat tier (letter / standard / large) from env vars,
// classified from Square catalog categories + product names — not live USPS rates.
import { squareConfig, squareFetch, json, missingSquareEnv } from "./_square.js";
import {
  quoteShipping,
  DEFAULT_STANDARD_SHIPPING_FEE_CENTS,
  shippingLabelForTier,
} from "./_shipping.js";

const DEFAULT_PICKUP_PREP = "P14D";
const OWNER_EMAIL = "skylar@wildhouselane.com";

function parseFulfillment(raw) {
  const v = String(raw || "ship")
    .trim()
    .toLowerCase();
  return v === "pickup" ? "pickup" : "ship";
}

function buildPickupFulfillment(env) {
  const prep = String(env.PICKUP_PREP_DURATION || DEFAULT_PICKUP_PREP).trim() || DEFAULT_PICKUP_PREP;
  const note = String(
    env.PICKUP_ORDER_NOTE ||
      "Local pickup selected. Wildhouse Lane will confirm when the order is ready."
  ).slice(0, 500);

  return {
    type: "PICKUP",
    state: "PROPOSED",
    pickup_details: {
      schedule_type: "ASAP",
      prep_time_duration: prep,
      recipient: { display_name: "Customer" },
      note,
    },
  };
}

export async function onRequestPost({ request, env }) {
  const cfg = squareConfig(env);
  if (!cfg.configured) {
    return json(
      {
        error: "Square not configured",
        missing: missingSquareEnv(env),
        environment: cfg.environment,
      },
      501
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const fulfillment = parseFulfillment(payload?.fulfillment);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const lineItems = items
    .filter((l) => l && l.variationId)
    .map((l) => {
      const item = {
        quantity: String(Math.max(1, parseInt(l.qty, 10) || 1)),
        catalog_object_id: l.variationId,
      };
      const note = String(l.note || "").trim();
      if (note) item.note = note.slice(0, 500);
      return item;
    });

  if (!lineItems.length) return json({ error: "Cart is empty" }, 400);

  const origin = new URL(request.url).origin;

  let shippingQuote;
  try {
    shippingQuote = await quoteShipping({
      env,
      cfg,
      fulfillment,
      items: lineItems.map((li) => ({ variationId: li.catalog_object_id })),
    });
  } catch (err) {
    console.error("checkout shipping quote failed", String(err?.message || err));
    shippingQuote = {
      tier: "standard",
      label: shippingLabelForTier("standard"),
      feeCents: DEFAULT_STANDARD_SHIPPING_FEE_CENTS,
    };
  }

  const studioNotes = lineItems.map((l) => l.note).filter(Boolean);
  const orderNoteParts = [];
  if (studioNotes.length) orderNoteParts.push(studioNotes.join(" | "));
  if (fulfillment === "pickup") {
    orderNoteParts.push("Fulfillment: LOCAL PICKUP");
  } else {
    orderNoteParts.push(`Fulfillment: SHIPPING (${shippingQuote.label})`);
  }
  const orderNote = orderNoteParts.join(" — ").slice(0, 500);

  const order = {
    location_id: cfg.locationId,
    line_items: lineItems,
    note: orderNote,
    pricing_options: {
      auto_apply_taxes: true,
    },
  };

  const checkoutOptions = {
    redirect_url: `${origin}/order-confirmation.html`,
    merchant_support_email: env.ORDER_NOTIFY_TO || env.NEWSLETTER_NOTIFY_TO || OWNER_EMAIL,
  };

  const appliedShippingFeeCents = fulfillment === "pickup" ? 0 : shippingQuote.feeCents || 0;

  if (fulfillment === "pickup") {
    order.fulfillments = [buildPickupFulfillment(env)];
    checkoutOptions.ask_for_shipping_address = false;
  } else {
    checkoutOptions.ask_for_shipping_address = true;
    if (appliedShippingFeeCents > 0) {
      checkoutOptions.shipping_fee = {
        name: shippingQuote.label || "Shipping",
        charge: { amount: appliedShippingFeeCents, currency: "USD" },
      };
    }
  }

  try {
    const res = await squareFetch(cfg, "/v2/online-checkout/payment-links", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        order,
        checkout_options: checkoutOptions,
      }),
    });

    const link = res.payment_link || {};
    return json({
      url: link.url,
      orderId: link.order_id,
      fulfillment,
      shippingTier: shippingQuote.tier,
      shippingLabel: shippingQuote.label,
      shippingFeeCents: appliedShippingFeeCents,
    });
  } catch (err) {
    const message = String(err?.message || err);
    const locationMismatch = /does not have a location|location with the id|invalid location/i.test(
      message
    );
    console.error("checkout payment-link failed", message);
    return json(
      {
        error: "We couldn't start checkout right now. Please try again.",
        environment: cfg.environment,
        ...(locationMismatch
          ? {
              hint: "SQUARE_LOCATION_ID must be the production Location ID when SQUARE_ENVIRONMENT=production.",
            }
          : {}),
      },
      502
    );
  }
}
