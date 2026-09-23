// Order confirmation — shown after Square redirects the customer back from the
// hosted checkout. Clears the cart on success, shows fulfillment details, and
// triggers server-side owner/customer emails via /api/order-notify.
import { clearCart } from "./store.js";
import { formatMoney } from "./catalog.js";
import { escapeHtml } from "./ui.js";
import { withAssetContentHash } from "./collection-assets.js";

const root = document.getElementById("confirmation-root");
const params = new URLSearchParams(location.search);
const orderId = params.get("orderId") || params.get("order_id");
const transactionId = params.get("transactionId") || params.get("transaction_id");

function summaryHTML(order) {
  if (!order || order.error) return "";
  const lines = (order.lineItems || [])
    .map(
      (li) =>
        `<li>${escapeHtml(li.name || "Item")} × ${escapeHtml(li.quantity || "1")}${
          li.total ? ` — ${formatMoney(li.total.amount, li.total.currency)}` : ""
        }</li>`
    )
    .join("");
  const total = order.total
    ? `<p class="order-total">Total: ${formatMoney(order.total.amount, order.total.currency)}</p>`
    : "";
  const tax = order.tax
    ? `<p class="order-tax">Tax: ${formatMoney(order.tax.amount, order.tax.currency)}</p>`
    : "";
  const ship =
    order.fulfillment?.type === "pickup"
      ? `<p class="order-ship">Local pickup: FREE</p>`
      : order.shipping
        ? `<p class="order-ship">Shipping: ${formatMoney(
            order.shipping.amount,
            order.shipping.currency
          )}</p>`
        : "";
  return lines ? `<ul class="order-lines">${lines}</ul>${ship}${tax}${total}` : `${ship}${tax}${total}`;
}

function pickupBlockHTML(pickup) {
  if (!pickup) return "";
  const parts = [];
  if (pickup.address) {
    parts.push(
      `<p><strong>Pickup location</strong><br>${escapeHtml(pickup.address).replace(
        /\n/g,
        "<br>"
      )}</p>`
    );
  }
  if (pickup.instructions) {
    parts.push(
      `<p><strong>Pickup instructions</strong><br>${escapeHtml(pickup.instructions).replace(
        /\n/g,
        "<br>"
      )}</p>`
    );
  }
  if (pickup.contact) {
    parts.push(`<p><strong>Questions?</strong><br>${escapeHtml(pickup.contact)}</p>`);
  }
  if (!parts.length) return "";
  return `<div class="order-pickup">${parts.join("")}</div>`;
}

async function fetchOrder() {
  if (!orderId) return null;
  try {
    const res = await fetch(`/api/order?orderId=${encodeURIComponent(orderId)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: data.error || `Order lookup failed (${res.status})`, status: res.status };
    }
    return data;
  } catch (_) {
    return { error: "Could not reach the order service." };
  }
}

async function notifyOrder() {
  if (!orderId) return null;
  try {
    const res = await fetch("/api/order-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    return await res.json().catch(() => ({}));
  } catch (_) {
    return null;
  }
}

function isSuccessfulState(state) {
  if (!state) return false;
  const s = String(state).toUpperCase();
  return s === "OPEN" || s === "COMPLETED" || s === "RESERVED";
}

function render({ title, body, ref, order, tone = "success", pickup = null }) {
  const fulfillmentNote =
    order?.fulfillment?.type === "pickup"
      ? `<p class="order-fulfillment">Fulfillment: <strong>Local pickup</strong></p>`
      : order?.fulfillment?.type === "ship"
        ? `<p class="order-fulfillment">Fulfillment: <strong>Shipping</strong></p>`
        : "";

  root.innerHTML = `
    <div class="confirmation confirmation--${tone}">
      <img src="${withAssetContentHash("./assets/WILDHOUSE-logomark.svg")}" alt="" class="confirmation-mark">
      <h1 class="page-title">${escapeHtml(title)}</h1>
      <p>${escapeHtml(body)}</p>
      ${fulfillmentNote}
      ${ref ? `<p class="order-ref">Order reference: <strong>${escapeHtml(ref)}</strong></p>` : ""}
      ${summaryHTML(order && !order.error ? order : null)}
      ${pickupBlockHTML(pickup)}
      <div class="confirmation-actions">
        <a class="btn secondary" href="./shop.html">Continue shopping</a>
        <a class="btn primary" href="./index.html">Back home</a>
      </div>
    </div>`;
}

async function init() {
  const ref = orderId || transactionId;

  if (!ref) {
    render({
      title: "No order to confirm",
      body: "We couldn't find an order reference in this link. If you just checked out, check your email receipt from Square or return to your cart.",
      tone: "warning",
    });
    return;
  }

  const order = await fetchOrder();
  const notify = await notifyOrder();

  if (!order?.error) {
    if (!order || isSuccessfulState(order.state) || !order.state) {
      clearCart();
      try {
        sessionStorage.removeItem("whl_fulfillment");
      } catch (_) {
        /* ignore */
      }
    }
  }

  const isPickup =
    order?.fulfillment?.type === "pickup" || notify?.fulfillment === "pickup";
  const pickup = notify?.pickup || null;

  if (order?.error) {
    render({
      title: "Thanks — we're confirming your order",
      body: "Your checkout finished, but we couldn't load the full order summary yet. Keep your Square receipt email for your records.",
      ref,
      tone: "warning",
      pickup: isPickup ? pickup : null,
    });
    return;
  }

  if (order && order.state && !isSuccessfulState(order.state)) {
    render({
      title: "Order update",
      body: `Square reports this order as ${order.state}. If you completed payment, refresh in a moment or check your receipt email.`,
      ref,
      order,
      tone: "warning",
    });
    return;
  }

  if (isPickup) {
    render({
      title: "Thank you for your order!",
      body: "Your payment was received and you've selected local pickup. Please wait for confirmation that your order is ready before coming to pick it up. A receipt has also been sent by Square.",
      ref,
      order,
      pickup,
      tone: "success",
    });
    return;
  }

  render({
    title: "Thank you for your order!",
    body: "Your payment was received and your order is confirmed. A receipt has been sent by Square.",
    ref,
    order,
    tone: "success",
  });
}

init();
