// POST /api/checkout
// Body: { items: [{ variationId, qty }] }
// Creates a Square Payment Link (Square-hosted checkout) and returns its URL.
// Pricing comes from the Square catalog (source of truth) — we send only
// catalog variation ids + quantities, never prices or card data.
import { squareConfig, squareFetch, json, missingSquareEnv } from "./_square.js";

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

  const items = Array.isArray(payload?.items) ? payload.items : [];
  const lineItems = items
    .filter((l) => l && l.variationId)
    .map((l) => {
      const item = {
        quantity: String(Math.max(1, parseInt(l.qty, 10) || 1)),
        catalog_object_id: l.variationId,
      };
      // Keychain Studio (and other custom builds) pass a human-readable design note.
      const note = String(l.note || "").trim();
      if (note) item.note = note.slice(0, 500);
      return item;
    });

  if (!lineItems.length) return json({ error: "Cart is empty" }, 400);

  const origin = new URL(request.url).origin;
  const studioNotes = lineItems.map((l) => l.note).filter(Boolean);
  const orderNote = studioNotes.length
    ? studioNotes.join(" | ").slice(0, 500)
    : undefined;

  try {
    const res = await squareFetch(cfg, "/v2/online-checkout/payment-links", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        order: {
          location_id: cfg.locationId,
          line_items: lineItems,
          ...(orderNote ? { note: orderNote } : {}),
        },
        checkout_options: {
          redirect_url: `${origin}/order-confirmation.html`,
          ask_for_shipping_address: true,
        },
      }),
    });

    const link = res.payment_link || {};
    return json({ url: link.url, orderId: link.order_id });
  } catch (err) {
    return json({ error: String(err?.message || err) }, 502);
  }
}
