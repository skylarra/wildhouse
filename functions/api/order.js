// GET /api/order?orderId=...
// Returns a trimmed order summary for the confirmation page (no secrets).
import { squareConfig, squareFetch, json, missingSquareEnv } from "./_square.js";

function money(m) {
  if (!m || typeof m.amount !== "number") return null;
  return { amount: m.amount, currency: m.currency || "USD" };
}

function formatAddress(addr) {
  if (!addr || typeof addr !== "object") return null;
  const parts = [
    addr.address_line_1,
    addr.address_line_2,
    [addr.locality, addr.administrative_district_level_1, addr.postal_code]
      .filter(Boolean)
      .join(", "),
    addr.country,
  ].filter(Boolean);
  return parts.length ? parts.join("\n") : null;
}

function summarizeFulfillment(order) {
  const list = Array.isArray(order.fulfillments) ? order.fulfillments : [];
  const f = list[0] || null;
  if (!f) {
    const note = String(order.note || "");
    if (/LOCAL PICKUP/i.test(note)) {
      return { type: "pickup", label: "Local pickup", state: null };
    }
    return { type: "ship", label: "Shipping", state: null };
  }

  const type = String(f.type || "").toUpperCase();
  if (type === "PICKUP") {
    const recipient = f.pickup_details?.recipient || {};
    return {
      type: "pickup",
      label: "Local pickup",
      state: f.state || null,
      recipientName: recipient.display_name || null,
      email: recipient.email_address || null,
      phone: recipient.phone_number || null,
    };
  }

  if (type === "SHIPMENT") {
    const recipient = f.shipment_details?.recipient || {};
    return {
      type: "ship",
      label: "Shipping",
      state: f.state || null,
      recipientName: recipient.display_name || null,
      email: recipient.email_address || null,
      phone: recipient.phone_number || null,
      address: formatAddress(recipient.address),
    };
  }

  return {
    type: type.toLowerCase() || "unknown",
    label: type || "Fulfillment",
    state: f.state || null,
  };
}

export async function onRequestGet({ request, env }) {
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

  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!orderId) return json({ error: "Missing orderId" }, 400);

  try {
    const res = await squareFetch(cfg, `/v2/orders/${encodeURIComponent(orderId)}`);
    const o = res.order || {};
    const fulfillment = summarizeFulfillment(o);

    const serviceCharges = o.service_charges || [];
    const shippingCharge = serviceCharges.find((sc) => /ship/i.test(String(sc.name || "")));
    const shippingMoney =
      fulfillment.type === "pickup"
        ? { amount: 0, currency: "USD" }
        : money(shippingCharge?.applied_money) ||
          money(shippingCharge?.total_money) ||
          money(o.total_service_charge_money);

    // Keep legacy keys (lineItems / total / state) for order-confirmation.js.
    return json({
      id: o.id,
      state: o.state,
      total: money(o.total_money),
      tax: money(o.total_tax_money),
      shipping: shippingMoney,
      fulfillment,
      lineItems: (o.line_items || []).map((li) => ({
        name: li.name,
        quantity: li.quantity,
        total: money(li.total_money),
      })),
    });
  } catch (err) {
    console.error("order lookup failed", String(err?.message || err));
    return json({ error: "We couldn't load this order right now." }, 502);
  }
}
