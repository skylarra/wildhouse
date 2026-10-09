// POST /api/checkout
// Body: {
//   items: [{ variationId, qty, note? }],
//   fulfillment?: "ship" | "pickup",
//   customer: { name, email, phone?, address? }
// }
// Creates a Square Payment Link (Square-hosted checkout) and returns { url, orderId }.
//
// Square handles:
//   - Catalog pricing (source of truth)
//   - Sales tax via order.pricing_options.auto_apply_taxes (catalog tax rules)
//   - Shipping via Square Dashboard shipping / Payment Link fulfillment settings
//     (we do NOT override with checkout_options.shipping_fee)
//   - Local pickup via order.fulfillments type PICKUP
//
// Customer email/name are required here before a link is created. Email is passed to Square via
// pickup recipient (pickup) or pre_populated_data.buyer_email (ship). Shipping address is
// required on our cart for ship orders and pre-filled on Square's hosted page.
import { squareConfig, squareFetch, json, missingSquareEnv } from "./_square.js";
import {
  loadSitePromoFromEnv,
  isSalePricingActive,
  promoBannerText,
} from "./_site-promo.js";

const DEFAULT_PICKUP_PREP = "P14D";
const OWNER_EMAIL = "skylar@wildhouselane.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseFulfillment(raw) {
  const v = String(raw || "ship")
    .trim()
    .toLowerCase();
  return v === "pickup" ? "pickup" : "ship";
}

function splitName(fullName = "") {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "Customer", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Optional phone → E.164 when possible; otherwise omit (Square rejects bad numbers). */
function normalizePhone(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^\+[1-9]\d{7,14}$/.test(s.replace(/[\s()-]/g, ""))) {
    return s.replace(/[\s()-]/g, "");
  }
  const digits = s.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

function parseCustomer(raw, fulfillment) {
  const name = String(raw?.name || "").trim();
  const email = String(raw?.email || "")
    .trim()
    .toLowerCase();
  const phone = String(raw?.phone || "").trim();
  const addr = raw?.address && typeof raw.address === "object" ? raw.address : {};
  const address = {
    line1: String(addr.line1 || "").trim(),
    line2: String(addr.line2 || "").trim(),
    city: String(addr.city || "").trim(),
    state: String(addr.state || "").trim(),
    postalCode: String(addr.postalCode || "").trim(),
    country: String(addr.country || "US")
      .trim()
      .toUpperCase() || "US",
  };

  const errors = [];
  if (!name) errors.push("Please enter your name.");
  if (!email) {
    errors.push("Please enter your email address so we can send your order confirmation.");
  } else if (!EMAIL_RE.test(email)) {
    errors.push("Please enter a valid email address so we can send your order confirmation.");
  }

  if (fulfillment === "ship") {
    if (!address.line1) errors.push("Please enter your shipping address.");
    if (!address.city) errors.push("Please enter your city.");
    if (!address.state) errors.push("Please enter your state.");
    if (!address.postalCode) errors.push("Please enter your ZIP / postal code.");
  }

  return {
    ok: errors.length === 0,
    errors,
    customer: {
      name,
      email,
      phone,
      phoneE164: normalizePhone(phone),
      address,
    },
  };
}

function buildPickupFulfillment(env, customer) {
  const prep = String(env.PICKUP_PREP_DURATION || DEFAULT_PICKUP_PREP).trim() || DEFAULT_PICKUP_PREP;
  const note = String(
    env.PICKUP_ORDER_NOTE ||
      "Local pickup selected. Wildhouse Lane will confirm when the order is ready."
  ).slice(0, 500);

  const recipient = {
    display_name: customer.name || "Customer",
    email_address: customer.email,
  };
  if (customer.phoneE164) recipient.phone_number = customer.phoneE164;

  return {
    type: "PICKUP",
    state: "PROPOSED",
    pickup_details: {
      schedule_type: "ASAP",
      prep_time_duration: prep,
      recipient,
      note,
    },
  };
}

function buildPrePopulatedData(customer) {
  const { firstName, lastName } = splitName(customer.name);
  const data = {
    buyer_email: customer.email,
  };
  if (customer.phoneE164) data.buyer_phone_number = customer.phoneE164;

  const a = customer.address || {};
  if (a.line1) {
    data.buyer_address = {
      first_name: firstName,
      last_name: lastName || undefined,
      address_line_1: a.line1,
      address_line_2: a.line2 || undefined,
      locality: a.city || undefined,
      administrative_district_level_1: a.state || undefined,
      postal_code: a.postalCode || undefined,
      country: a.country || "US",
    };
  }
  return data;
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const fulfillment = parseFulfillment(payload?.fulfillment);
  const parsed = parseCustomer(payload?.customer, fulfillment);
  if (!parsed.ok) {
    return json(
      {
        error: parsed.errors[0] || "Please complete the required customer fields.",
        fieldErrors: parsed.errors,
      },
      400
    );
  }
  const customer = parsed.customer;

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

  const studioNotes = lineItems.map((l) => l.note).filter(Boolean);
  const orderNoteParts = [];
  if (studioNotes.length) orderNoteParts.push(studioNotes.join(" | "));
  if (fulfillment === "pickup") {
    orderNoteParts.push("Fulfillment: LOCAL PICKUP");
  } else {
    orderNoteParts.push("Fulfillment: SHIPPING (Square shipping rates)");
  }
  orderNoteParts.push(`Customer: ${customer.name} <${customer.email}>`);
  const orderNote = orderNoteParts.join(" — ").slice(0, 500);

  const promo = await loadSitePromoFromEnv(env);
  const saleActive = isSalePricingActive(promo);

  const order = {
    location_id: cfg.locationId,
    line_items: lineItems,
    note: orderNote,
    pricing_options: {
      auto_apply_taxes: true,
    },
    // Backup for order-notify if Square fulfillment recipient email is empty.
    metadata: {
      customer_email: customer.email.slice(0, 191),
      customer_name: customer.name.slice(0, 191),
    },
  };

  // Match storefront sale display: apply the same percent as an order discount.
  if (saleActive) {
    const label =
      promoBannerText(promo).slice(0, 255) || `${promo.discountPercent}% off`;
    order.discounts = [
      {
        uid: "site-sale",
        name: label,
        percentage: String(promo.discountPercent),
        scope: "ORDER",
      },
    ];
    if (promo.promoCode) {
      order.metadata.promo_code = promo.promoCode.slice(0, 191);
    }
    order.metadata.sale_percent = String(promo.discountPercent).slice(0, 191);
  }

  const checkoutOptions = {
    redirect_url: `${origin}/order-confirmation.html`,
    merchant_support_email: env.ORDER_NOTIFY_TO || env.NEWSLETTER_NOTIFY_TO || OWNER_EMAIL,
  };

  // Payment Link payload. Pickup uses fulfillment recipient for contact email
  // (cannot combine fulfillments with pre_populated_data.buyer_email).
  // Ship: ask for shipping address and do NOT set shipping_fee — Square applies
  // the merchant's configured shipping rates from the Dashboard.
  let prePopulatedData = null;

  if (fulfillment === "pickup") {
    order.fulfillments = [buildPickupFulfillment(env, customer)];
    checkoutOptions.ask_for_shipping_address = false;
  } else {
    checkoutOptions.ask_for_shipping_address = true;
    prePopulatedData = buildPrePopulatedData(customer);
  }

  try {
    const body = {
      idempotency_key: crypto.randomUUID(),
      order,
      checkout_options: checkoutOptions,
    };
    if (prePopulatedData) body.pre_populated_data = prePopulatedData;

    const res = await squareFetch(cfg, "/v2/online-checkout/payment-links", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const link = res.payment_link || {};
    return json({
      url: link.url,
      orderId: link.order_id,
      fulfillment,
      shippingSource: fulfillment === "pickup" ? "pickup" : "square",
      shippingFeeCents: fulfillment === "pickup" ? 0 : null,
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
