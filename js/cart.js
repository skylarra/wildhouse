// Cart page — line items, quantity controls, fulfillment choice (ship / pickup),
// subtotal + estimated shipping, and Square Payment Link checkout.
import { getCart, setQty, removeFromCart, cartSubtotalCents } from "./store.js";
import { formatMoney } from "./catalog.js";
import { loadSite, sitePath } from "./content.js";
import { escapeHtml, toast } from "./ui.js";

const root = document.getElementById("cart-root");
let freeShippingThresholdCents = 7500;
let shippingFeeCents = 699;
/** @type {"ship" | "pickup"} */
let fulfillment = "ship";

try {
  const saved = sessionStorage.getItem("whl_fulfillment");
  if (saved === "pickup" || saved === "ship") fulfillment = saved;
} catch (_) {
  /* ignore */
}

function lineHTML(line) {
  const variant = line.variationName
    ? `<p class="cart-line__variant">${escapeHtml(line.variationName)}</p>`
    : "";
  const note = line.note ? `<p class="cart-line__note">${escapeHtml(line.note)}</p>` : "";
  const href =
    line.handle === "custom-keychain" || line.studioDesign
      ? "./custom-creations.html"
      : `./product.html?handle=${encodeURIComponent(line.handle)}`;
  return `
    <div class="cart-line" data-variation-id="${line.variationId}">
      <a href="${href}" class="cart-line__media">
        <img src="${line.image}" alt="${escapeHtml(line.name)}" loading="lazy">
      </a>
      <div class="cart-line__info">
        <a href="${href}"><h3>${escapeHtml(line.name)}</h3></a>
        ${variant}
        ${note}
        <p class="cart-line__price">${formatMoney(line.priceCents)}</p>
      </div>
      <div class="cart-line__qty">
        <button class="qty-btn" data-action="dec" aria-label="Decrease quantity">&minus;</button>
        <input class="qty-input" type="number" min="0" value="${line.qty}" aria-label="Quantity">
        <button class="qty-btn" data-action="inc" aria-label="Increase quantity">+</button>
      </div>
      <p class="cart-line__subtotal">${formatMoney(line.priceCents * line.qty)}</p>
      <button class="cart-line__remove" data-action="remove" aria-label="Remove item">&times;</button>
    </div>`;
}

function estimatedShippingCents(subtotal) {
  if (fulfillment === "pickup") return 0;
  if (freeShippingThresholdCents > 0 && subtotal >= freeShippingThresholdCents) return 0;
  return shippingFeeCents;
}

function shippingNote(subtotal) {
  if (fulfillment === "pickup") {
    return "Local pickup is free. We'll confirm when your order is ready.";
  }
  const remaining = Math.max(0, freeShippingThresholdCents - subtotal);
  if (remaining === 0) return "You've unlocked free shipping!";
  return `You're ${formatMoney(remaining)} away from free shipping.`;
}

function render() {
  const cart = getCart();
  if (!cart.length) {
    root.innerHTML = `
      <div class="cart-empty empty-state">
        <h1 class="empty-state__title">Your cart is empty</h1>
        <p class="empty-state__body">Find something handmade to love — or browse collections for a little inspiration.</p>
        <div class="empty-state__actions">
          <a class="btn secondary" href="./shop.html">Shop all products</a>
          <a class="btn" href="./collections.html">Browse collections</a>
        </div>
      </div>`;
    return;
  }

  const subtotal = cartSubtotalCents();
  const shipCents = estimatedShippingCents(subtotal);

  root.innerHTML = `
    <h1>Your Cart</h1>
    <div class="cart-layout">
      <div class="cart-lines">${cart.map(lineHTML).join("")}</div>
      <aside class="cart-summary">
        <h2>Summary</h2>

        <fieldset class="cart-fulfillment">
          <legend>Fulfillment</legend>
          <label class="cart-fulfillment__option">
            <input type="radio" name="fulfillment" value="ship" ${
              fulfillment === "ship" ? "checked" : ""
            }>
            <span>Ship to me</span>
          </label>
          <label class="cart-fulfillment__option">
            <input type="radio" name="fulfillment" value="pickup" ${
              fulfillment === "pickup" ? "checked" : ""
            }>
            <span>Local pickup — <strong>FREE</strong></span>
          </label>
        </fieldset>

        <div class="cart-summary__row"><span>Subtotal</span><span id="cart-subtotal">${formatMoney(
          subtotal
        )}</span></div>
        <div class="cart-summary__row"><span>${
          fulfillment === "pickup" ? "Local pickup" : "Shipping"
        }</span><span id="cart-shipping">${
          shipCents === 0 ? "FREE" : formatMoney(shipCents)
        }</span></div>
        <div class="cart-summary__row cart-summary__row--muted"><span>Tax</span><span>Calculated at checkout</span></div>
        <p class="cart-summary__ship">${shippingNote(subtotal)}</p>
        <button class="btn secondary cart-checkout" id="checkout-btn" type="button">Checkout</button>
        <p class="cart-summary__note">Secure checkout powered by Square. Sales tax is applied by Square on the next step.</p>
        <a class="cart-continue" href="./shop.html">Continue shopping</a>
      </aside>
    </div>`;

  wire();
}

function wire() {
  root.querySelectorAll(".cart-line").forEach((lineEl) => {
    const id = lineEl.dataset.variationId;
    const input = lineEl.querySelector(".qty-input");

    lineEl.querySelector('[data-action="inc"]').addEventListener("click", () => {
      setQty(id, (parseInt(input.value, 10) || 0) + 1);
      render();
    });
    lineEl.querySelector('[data-action="dec"]').addEventListener("click", () => {
      setQty(id, (parseInt(input.value, 10) || 0) - 1);
      render();
    });
    input.addEventListener("change", () => {
      setQty(id, parseInt(input.value, 10) || 0);
      render();
    });
    lineEl.querySelector('[data-action="remove"]').addEventListener("click", () => {
      removeFromCart(id);
      render();
    });
  });

  root.querySelectorAll('input[name="fulfillment"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      fulfillment = radio.value === "pickup" ? "pickup" : "ship";
      try {
        sessionStorage.setItem("whl_fulfillment", fulfillment);
      } catch (_) {
        /* ignore */
      }
      render();
    });
  });

  const checkout = document.getElementById("checkout-btn");
  if (checkout) {
    checkout.addEventListener("click", () => startCheckout(checkout));
  }
}

async function startCheckout(button) {
  const cart = getCart();
  if (!cart.length) return;

  const originalLabel = button.textContent;
  button.disabled = true;
  button.classList.add("is-loading");
  button.setAttribute("aria-busy", "true");
  button.textContent = "Redirecting…";

  try {
    const res = await fetch(sitePath("api/checkout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fulfillment,
        items: cart.map((l) => ({
          variationId: l.catalogVariationId || l.variationId,
          qty: l.qty,
          note: l.note || "",
        })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    throw new Error(data.error || `Checkout failed (${res.status})`);
  } catch (err) {
    console.error(err);
    button.disabled = false;
    button.classList.remove("is-loading");
    button.removeAttribute("aria-busy");
    button.textContent = originalLabel;
    toast("We couldn't complete your order right now. Please try again.");
  }
}

document.addEventListener("cart:change", render);

loadSite()
  .then((site) => {
    freeShippingThresholdCents =
      site.freeShippingThresholdCents ?? freeShippingThresholdCents;
    shippingFeeCents = site.shippingFeeCents ?? shippingFeeCents;
  })
  .catch((err) => console.error(err))
  .finally(render);
