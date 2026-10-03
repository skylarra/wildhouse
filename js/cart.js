// Cart page — line items, quantity controls, fulfillment choice (ship / pickup),
// required customer contact fields, and Square Payment Link checkout.
// Shipping amounts for ship orders come from Square (Dashboard shipping rates),
// not a site-side letter/standard/large calculator.
import { getCart, setQty, removeFromCart, cartSubtotalCents } from "./store.js";
import { formatMoney } from "./catalog.js";
import { loadSite, sitePath } from "./content.js";
import { escapeHtml, toast } from "./ui.js";

const root = document.getElementById("cart-root");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MSG = "Please enter your email address so we can send your order confirmation.";
const CUSTOMER_KEY = "whl_checkout_customer";

/** @type {"ship" | "pickup"} */
let fulfillment = "ship";

/** @type {{ name: string, email: string, phone: string, line1: string, line2: string, city: string, state: string, postalCode: string, country: string }} */
let customer = {
  name: "",
  email: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
};

/** @type {Record<string, string>} */
let fieldErrors = {};

try {
  const saved = sessionStorage.getItem("whl_fulfillment");
  if (saved === "pickup" || saved === "ship") fulfillment = saved;
} catch (_) {
  /* ignore */
}

try {
  const raw = sessionStorage.getItem(CUSTOMER_KEY);
  if (raw) customer = { ...customer, ...JSON.parse(raw) };
} catch (_) {
  /* ignore */
}

function persistCustomer() {
  try {
    sessionStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
  } catch (_) {
    /* ignore */
  }
}

function readCustomerFromDom() {
  const get = (id) => document.getElementById(id)?.value?.trim() || "";
  customer = {
    name: get("cart-customer-name"),
    email: get("cart-customer-email"),
    phone: get("cart-customer-phone"),
    line1: get("cart-ship-line1"),
    line2: get("cart-ship-line2"),
    city: get("cart-ship-city"),
    state: get("cart-ship-state"),
    postalCode: get("cart-ship-postal"),
    country: get("cart-ship-country") || "US",
  };
  persistCustomer();
}

function validateCustomer() {
  const errors = {};
  if (!customer.name) errors.name = "Please enter your name.";
  if (!customer.email) {
    errors.email = EMAIL_MSG;
  } else if (!EMAIL_RE.test(customer.email)) {
    errors.email = EMAIL_MSG;
  }
  const phoneDigits = String(customer.phone || "").replace(/\D/g, "");
  if (!customer.phone.trim()) {
    errors.phone = "Please enter your phone number.";
  } else if (phoneDigits.length < 10) {
    errors.phone = "Please enter a valid phone number.";
  }

  if (fulfillment === "ship") {
    if (!customer.line1) errors.line1 = "Please enter your shipping address.";
    if (!customer.city) errors.city = "Please enter your city.";
    if (!customer.state) errors.state = "Please enter your state.";
    if (!customer.postalCode) errors.postalCode = "Please enter your ZIP / postal code.";
  }

  fieldErrors = errors;
  return Object.keys(errors).length === 0;
}

function fieldErrorHTML(key) {
  const msg = fieldErrors[key];
  if (!msg) return "";
  return `<p class="cart-customer__error" id="cart-err-${key}" role="alert">${escapeHtml(msg)}</p>`;
}

function customerFieldsHTML() {
  const shipHidden = fulfillment === "ship" ? "" : " hidden";
  return `
    <fieldset class="cart-customer">
      <legend>Your details</legend>
      <p class="cart-customer__hint">We’ll use this email for your order confirmation${
        fulfillment === "pickup" ? " and pickup updates" : ""
      }.</p>

      <label class="cart-customer__field" for="cart-customer-name">
        <span>Name <abbr title="required">*</abbr></span>
        <input id="cart-customer-name" name="name" type="text" autocomplete="name" required
          value="${escapeHtml(customer.name)}" aria-invalid="${fieldErrors.name ? "true" : "false"}"
          ${fieldErrors.name ? 'aria-describedby="cart-err-name"' : ""}>
      </label>
      ${fieldErrorHTML("name")}

      <label class="cart-customer__field" for="cart-customer-email">
        <span>Email address <abbr title="required">*</abbr></span>
        <input id="cart-customer-email" name="email" type="email" autocomplete="email" required
          inputmode="email" value="${escapeHtml(customer.email)}"
          aria-invalid="${fieldErrors.email ? "true" : "false"}"
          ${fieldErrors.email ? 'aria-describedby="cart-err-email"' : ""}>
      </label>
      ${fieldErrorHTML("email")}

      <label class="cart-customer__field" for="cart-customer-phone">
        <span>Phone <abbr title="required">*</abbr></span>
        <input id="cart-customer-phone" name="phone" type="tel" autocomplete="tel" required
          value="${escapeHtml(customer.phone)}"
          aria-invalid="${fieldErrors.phone ? "true" : "false"}"
          ${fieldErrors.phone ? 'aria-describedby="cart-err-phone"' : ""}>
      </label>
      ${fieldErrorHTML("phone")}

      <div class="cart-customer__ship" id="cart-ship-fields"${shipHidden}>
        <p class="cart-customer__ship-title">Shipping address</p>
        <label class="cart-customer__field" for="cart-ship-line1">
          <span>Address <abbr title="required">*</abbr></span>
          <input id="cart-ship-line1" name="address-line1" type="text" autocomplete="address-line1"
            value="${escapeHtml(customer.line1)}" aria-invalid="${fieldErrors.line1 ? "true" : "false"}"
            ${fieldErrors.line1 ? 'aria-describedby="cart-err-line1"' : ""}>
        </label>
        ${fieldErrorHTML("line1")}

        <label class="cart-customer__field" for="cart-ship-line2">
          <span>Apartment, suite, etc. <span class="cart-customer__optional">(optional)</span></span>
          <input id="cart-ship-line2" name="address-line2" type="text" autocomplete="address-line2"
            value="${escapeHtml(customer.line2)}">
        </label>

        <div class="cart-customer__row">
          <label class="cart-customer__field" for="cart-ship-city">
            <span>City <abbr title="required">*</abbr></span>
            <input id="cart-ship-city" name="city" type="text" autocomplete="address-level2"
              value="${escapeHtml(customer.city)}" aria-invalid="${fieldErrors.city ? "true" : "false"}"
              ${fieldErrors.city ? 'aria-describedby="cart-err-city"' : ""}>
          </label>
          <label class="cart-customer__field" for="cart-ship-state">
            <span>State <abbr title="required">*</abbr></span>
            <input id="cart-ship-state" name="state" type="text" autocomplete="address-level1"
              value="${escapeHtml(customer.state)}" aria-invalid="${fieldErrors.state ? "true" : "false"}"
              ${fieldErrors.state ? 'aria-describedby="cart-err-state"' : ""}>
          </label>
        </div>
        ${fieldErrorHTML("city")}
        ${fieldErrorHTML("state")}

        <div class="cart-customer__row">
          <label class="cart-customer__field" for="cart-ship-postal">
            <span>ZIP <abbr title="required">*</abbr></span>
            <input id="cart-ship-postal" name="postal-code" type="text" autocomplete="postal-code"
              value="${escapeHtml(customer.postalCode)}" aria-invalid="${fieldErrors.postalCode ? "true" : "false"}"
              ${fieldErrors.postalCode ? 'aria-describedby="cart-err-postalCode"' : ""}>
          </label>
          <label class="cart-customer__field" for="cart-ship-country">
            <span>Country</span>
            <input id="cart-ship-country" name="country" type="text" autocomplete="country-name"
              value="${escapeHtml(customer.country || "US")}">
          </label>
        </div>
        ${fieldErrorHTML("postalCode")}
      </div>
    </fieldset>`;
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

function shippingRowLabel() {
  if (fulfillment === "pickup") return "Local Pickup";
  return "Shipping";
}

function shippingRowValue() {
  if (fulfillment === "pickup") return "FREE";
  return "Calculated at checkout";
}

function shippingNote() {
  if (fulfillment === "pickup") {
    return "Local pickup is free. We'll confirm when your order is ready.";
  }
  return "Shipping is calculated at checkout.";
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
            <span>Local pickup in Pendleton, SC — FREE</span>
          </label>
        </fieldset>

        ${customerFieldsHTML()}

        <div class="cart-summary__row"><span>Subtotal</span><span id="cart-subtotal">${formatMoney(
          subtotal
        )}</span></div>
        <div class="cart-summary__row${
          fulfillment === "ship" ? " cart-summary__row--muted" : ""
        }"><span id="cart-shipping-label">${escapeHtml(
          shippingRowLabel()
        )}</span><span id="cart-shipping">${shippingRowValue()}</span></div>
        <div class="cart-summary__row cart-summary__row--muted"><span>Tax</span><span>Calculated at checkout</span></div>
        <p class="cart-summary__ship" id="cart-shipping-note">${escapeHtml(shippingNote())}</p>
        <button class="btn secondary cart-checkout" id="checkout-btn" type="button">Checkout</button>
        <p class="cart-summary__note">Secure checkout powered by Square. Shipping and sales tax are calculated at checkout.</p>
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
      readCustomerFromDom();
      setQty(id, (parseInt(input.value, 10) || 0) + 1);
      render();
    });
    lineEl.querySelector('[data-action="dec"]').addEventListener("click", () => {
      readCustomerFromDom();
      setQty(id, (parseInt(input.value, 10) || 0) - 1);
      render();
    });
    input.addEventListener("change", () => {
      readCustomerFromDom();
      setQty(id, parseInt(input.value, 10) || 0);
      render();
    });
    lineEl.querySelector('[data-action="remove"]').addEventListener("click", () => {
      readCustomerFromDom();
      removeFromCart(id);
      render();
    });
  });

  root.querySelectorAll('input[name="fulfillment"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      readCustomerFromDom();
      fulfillment = radio.value === "pickup" ? "pickup" : "ship";
      fieldErrors = {};
      try {
        sessionStorage.setItem("whl_fulfillment", fulfillment);
      } catch (_) {
        /* ignore */
      }
      render();
    });
  });

  root.querySelectorAll(".cart-customer input").forEach((input) => {
    input.addEventListener("change", () => {
      readCustomerFromDom();
    });
    input.addEventListener("blur", () => {
      readCustomerFromDom();
    });
    input.addEventListener("input", () => {
      const id = input.id || "";
      const key =
        id === "cart-customer-name"
          ? "name"
          : id === "cart-customer-email"
            ? "email"
            : id === "cart-customer-phone"
              ? "phone"
              : id === "cart-ship-line1"
                ? "line1"
                : id === "cart-ship-city"
                  ? "city"
                  : id === "cart-ship-state"
                    ? "state"
                    : id === "cart-ship-postal"
                      ? "postalCode"
                      : null;
      if (key && fieldErrors[key]) {
        delete fieldErrors[key];
        input.setAttribute("aria-invalid", "false");
        input.removeAttribute("aria-describedby");
        document.getElementById(`cart-err-${key}`)?.remove();
      }
    });
  });

  const checkout = document.getElementById("checkout-btn");
  if (checkout) {
    checkout.addEventListener("click", () => startCheckout(checkout));
  }
}

function customerPayload() {
  const payload = {
    name: customer.name,
    email: customer.email,
    phone: customer.phone || "",
  };
  if (fulfillment === "ship") {
    payload.address = {
      line1: customer.line1,
      line2: customer.line2,
      city: customer.city,
      state: customer.state,
      postalCode: customer.postalCode,
      country: customer.country || "US",
    };
  }
  return payload;
}

function focusFirstError() {
  const order = ["name", "email", "phone", "line1", "city", "state", "postalCode"];
  for (const key of order) {
    if (!fieldErrors[key]) continue;
    const idMap = {
      name: "cart-customer-name",
      email: "cart-customer-email",
      phone: "cart-customer-phone",
      line1: "cart-ship-line1",
      city: "cart-ship-city",
      state: "cart-ship-state",
      postalCode: "cart-ship-postal",
    };
    const el = document.getElementById(idMap[key]);
    if (el) {
      el.focus();
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    break;
  }
}

async function startCheckout(button) {
  const cart = getCart();
  if (!cart.length) return;

  readCustomerFromDom();
  if (!validateCustomer()) {
    render();
    // After re-render, focus the first invalid field.
    requestAnimationFrame(focusFirstError);
    return;
  }

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
        customer: customerPayload(),
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
    if (res.status === 400 && data.error) {
      // Prefer server email message when present.
      if (/email/i.test(data.error)) fieldErrors = { ...fieldErrors, email: data.error };
      render();
      requestAnimationFrame(focusFirstError);
      toast(data.error);
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

document.addEventListener("cart:change", () => {
  readCustomerFromDom();
  render();
});

loadSite()
  .catch((err) => console.error(err))
  .finally(render);
