// GET|POST /api/shipping-quote
// Shipping is no longer calculated by this site. Square applies the merchant's
// Dashboard shipping rate profile / Payment Link fulfillment shipping at checkout.
// Kept as a thin compatibility endpoint so older clients do not 404.
import { json } from "./_square.js";

function squareDeferredPayload(fulfillment = "ship") {
  const fulfill = fulfillment === "pickup" ? "pickup" : "ship";
  if (fulfill === "pickup") {
    return {
      ok: true,
      fulfillment: "pickup",
      tier: "pickup",
      label: "Local Pickup",
      feeCents: 0,
      rateSource: "square",
      note: "Local pickup is free.",
    };
  }
  return {
    ok: true,
    fulfillment: "ship",
    tier: "square",
    label: "Shipping",
    feeCents: null,
    rateSource: "square",
    note: "Shipping is calculated by Square at checkout from your shipping rate profile.",
  };
}

export async function onRequestPost({ request }) {
  let payload = {};
  try {
    payload = await request.json();
  } catch {
    /* empty body is fine */
  }
  const fulfillment =
    String(payload?.fulfillment || "ship").toLowerCase() === "pickup" ? "pickup" : "ship";
  return json(squareDeferredPayload(fulfillment));
}

export async function onRequestGet() {
  return json(squareDeferredPayload("ship"));
}
