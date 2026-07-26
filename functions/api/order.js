// GET /api/order?orderId=...
// Returns a trimmed order summary for the confirmation page.
import { squareConfig, squareFetch, json } from "./_square.js";

export async function onRequestGet({ request, env }) {
  const cfg = squareConfig(env);
  if (!cfg.configured) return json({ error: "Square not configured" }, 501);

  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!orderId) return json({ error: "Missing orderId" }, 400);

  try {
    const res = await squareFetch(cfg, `/v2/orders/${encodeURIComponent(orderId)}`);
    const o = res.order || {};
    return json({
      id: o.id,
      state: o.state,
      total: o.total_money || null,
      lineItems: (o.line_items || []).map((li) => ({
        name: li.name,
        quantity: li.quantity,
        total: li.total_money || null,
      })),
    });
  } catch (err) {
    return json({ error: String(err?.message || err) }, 502);
  }
}
