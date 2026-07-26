// Order confirmation — shown after Square redirects the customer back from the
// hosted checkout. Only clears the cart / claims success when an order id is
// present and (when available) Square reports a non-draft/canceled state.
import { clearCart } from "./store.js";
import { formatMoney } from "./catalog.js";
import { escapeHtml } from "./ui.js";

const root = document.getElementById("confirmation-root");
const params = new URLSearchParams(location.search);
// Square appends order/transaction identifiers to the redirect URL.
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
  return lines ? `<ul class="order-lines">${lines}</ul>${total}` : total;
}

async function fetchOrder() {
  if (!orderId) return null;
  try {
    const res = await fetch(`./api/order?orderId=${encodeURIComponent(orderId)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || `Order lookup failed (${res.status})`, status: res.status };
    return data;
  } catch (_) {
    return { error: "Could not reach the order service." };
  }
}

function isSuccessfulState(state) {
  if (!state) return false;
  const s = String(state).toUpperCase();
  return s === "OPEN" || s === "COMPLETED" || s === "RESERVED";
}

function render({ title, body, ref, order, tone = "success" }) {
  root.innerHTML = `
    <div class="confirmation confirmation--${tone}">
      <img src="./assets/WILDHOUSE-logomark.svg" alt="" class="confirmation-mark">
      <h1 class="page-title">${escapeHtml(title)}</h1>
      <p>${escapeHtml(body)}</p>
      ${ref ? `<p class="order-ref">Order reference: <strong>${escapeHtml(ref)}</strong></p>` : ""}
      ${summaryHTML(order && !order.error ? order : null)}
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

  // Clear the local cart only when we have a checkout return reference.
  // Prefer verifying Square state when the order API responds successfully.
  if (!order?.error) {
    if (!order || isSuccessfulState(order.state) || !order.state) {
      clearCart();
    }
  }

  if (order?.error) {
    render({
      title: "Thanks — we're confirming your order",
      body: "Your checkout finished, but we couldn't load the full order summary yet. Keep your Square receipt email for your records.",
      ref,
      tone: "warning",
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

  render({
    title: "Thank you for your order!",
    body: "Your payment was received and your order is confirmed. A receipt has been sent by Square.",
    ref,
    order,
    tone: "success",
  });
}

init();
