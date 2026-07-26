// Order confirmation — shown after Square redirects the customer back from the
// hosted checkout. Clears the cart and, when possible, shows an order summary.
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
  const total = order.total ? `<p class="order-total">Total: ${formatMoney(order.total.amount, order.total.currency)}</p>` : "";
  return lines ? `<ul class="order-lines">${lines}</ul>${total}` : total;
}

async function fetchOrder() {
  if (!orderId) return null;
  try {
    const res = await fetch(`./api/order?orderId=${encodeURIComponent(orderId)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

async function init() {
  // The customer has paid on Square's hosted page, so empty the local cart.
  clearCart();

  const order = await fetchOrder();
  const ref = orderId || transactionId;

  root.innerHTML = `
    <div class="confirmation">
      <img src="./assets/WILDHOUSE-logomark.svg" alt="" class="confirmation-mark">
      <h1 class="page-title">Thank you for your order!</h1>
      <p>Your payment was received and your order is confirmed. A receipt has been sent by Square.</p>
      ${ref ? `<p class="order-ref">Order reference: <strong>${escapeHtml(ref)}</strong></p>` : ""}
      ${summaryHTML(order)}
      <div class="confirmation-actions">
        <a class="btn secondary" href="./shop.html">Continue shopping</a>
        <a class="btn primary" href="./index.html">Back home</a>
      </div>
    </div>`;
}

init();
