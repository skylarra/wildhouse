// POST /api/order-notify
// Body: { orderId: string }
// After Square redirects to confirmation, the page calls this once to:
//   1) email the customer (pickup instructions when local pickup)
//   2) email the store owner with fulfillment details
// Idempotent via EMAIL_SUBSCRIBERS KV key order-notify:{orderId} when KV is bound.
// Pickup address comes from env only — never from the browser before purchase.
import { squareConfig, squareFetch, json, missingSquareEnv } from "./_square.js";
import { sendEmail, escapeEmailHtml, emailConfigured } from "./_email.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_NOTIFY_TO = "skylar@wildhouselane.com";
const MAX_BODY_BYTES = 2048;

function moneyFmt(m) {
  if (!m || typeof m.amount !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: m.currency || "USD",
  }).format(m.amount / 100);
}

function formatAddress(addr) {
  if (!addr || typeof addr !== "object") return "";
  return [
    addr.address_line_1,
    addr.address_line_2,
    [addr.locality, addr.administrative_district_level_1, addr.postal_code]
      .filter(Boolean)
      .join(", "),
    addr.country,
  ]
    .filter(Boolean)
    .join("\n");
}

function fulfillmentInfo(order) {
  const f = (order.fulfillments || [])[0];
  const note = String(order.note || "");
  if (!f) {
    if (/LOCAL PICKUP/i.test(note)) {
      return { kind: "pickup", recipient: {}, address: "", state: null };
    }
    return { kind: "ship", recipient: {}, address: "", state: null };
  }
  const type = String(f.type || "").toUpperCase();
  if (type === "PICKUP") {
    return {
      kind: "pickup",
      state: f.state || null,
      recipient: f.pickup_details?.recipient || {},
      address: "",
    };
  }
  const recipient = f.shipment_details?.recipient || {};
  return {
    kind: "ship",
    state: f.state || null,
    recipient,
    address: formatAddress(recipient.address),
  };
}

function extractBuyerEmail(_order, fulfillment) {
  const fromFulfillment = String(fulfillment.recipient?.email_address || "")
    .trim()
    .toLowerCase();
  if (fromFulfillment && EMAIL_RE.test(fromFulfillment)) return fromFulfillment;
  return "";
}

function lineItemsText(order) {
  return (order.line_items || [])
    .map((li) => {
      const name = li.name || "Item";
      const qty = li.quantity || "1";
      const total = moneyFmt(li.total_money);
      return `• ${name} × ${qty} — ${total}`;
    })
    .join("\n");
}

function pickupConfig(env) {
  return {
    address: String(env.PICKUP_ADDRESS || "").trim(),
    instructions: String(env.PICKUP_INSTRUCTIONS || "").trim(),
    contact: String(env.PICKUP_CONTACT || env.ORDER_NOTIFY_TO || DEFAULT_NOTIFY_TO).trim(),
  };
}

async function alreadySent(kv, orderId) {
  if (!kv) return false;
  return Boolean(await kv.get(`order-notify:${orderId}`));
}

async function markSent(kv, orderId) {
  if (!kv) return;
  await kv.put(`order-notify:${orderId}`, new Date().toISOString(), {
    expirationTtl: 60 * 60 * 24 * 90,
  });
}

export async function onRequestPost({ request, env }) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413);

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
    return json({ error: "Invalid request" }, 400);
  }

  const orderId = String(payload?.orderId || "").trim();
  if (!orderId || orderId.length > 191) {
    return json({ error: "Missing orderId" }, 400);
  }

  const kv = env.EMAIL_SUBSCRIBERS;
  if (await alreadySent(kv, orderId)) {
    return json({ ok: true, status: "already_notified" });
  }

  let order;
  try {
    const res = await squareFetch(cfg, `/v2/orders/${encodeURIComponent(orderId)}`);
    order = res.order || {};
  } catch (err) {
    console.error("order-notify retrieve failed", String(err?.message || err));
    return json({ error: "We couldn't confirm this order yet." }, 502);
  }

  const state = String(order.state || "").toUpperCase();
  if (state === "DRAFT" || state === "CANCELED" || state === "CANCELLED") {
    return json({ ok: false, status: "not_ready", state }, 409);
  }

  const fulfillment = fulfillmentInfo(order);
  const buyerEmail = extractBuyerEmail(order, fulfillment);
  const customerName =
    String(fulfillment.recipient?.display_name || "").trim() || "Customer";
  const notifyTo = env.ORDER_NOTIFY_TO || env.NEWSLETTER_NOTIFY_TO || DEFAULT_NOTIFY_TO;
  const pickup = pickupConfig(env);
  const itemsText = lineItemsText(order);
  const totalText = moneyFmt(order.total_money);
  const taxText = moneyFmt(order.total_tax_money);

  const publicPickup =
    fulfillment.kind === "pickup"
      ? {
          address: pickup.address || null,
          instructions: pickup.instructions || null,
          contact: pickup.contact || null,
        }
      : null;

  try {
    await markSent(kv, orderId);
  } catch (err) {
    console.error("order-notify idempotency put failed", String(err?.message || err));
  }

  if (!emailConfigured(env)) {
    console.error("order-notify skipped — RESEND_API_KEY or EMAIL_FROM missing");
    return json({
      ok: true,
      status: "saved_no_email",
      fulfillment: fulfillment.kind,
      pickup: publicPickup,
    });
  }

  const fulfillLabel = fulfillment.kind === "pickup" ? "LOCAL PICKUP" : "SHIPPING";
  const adminSubject = "NEW WILDHOUSE LANE ORDER";
  const adminText = [
    "NEW WILDHOUSE LANE ORDER",
    "",
    `Order #${orderId}`,
    `Customer: ${customerName}`,
    `Email: ${buyerEmail || "(collected by Square)"}`,
    "",
    `Fulfillment: ${fulfillLabel}`,
    fulfillment.kind === "pickup" ? `Pickup status: ${fulfillment.state || "PROPOSED"}` : "",
    fulfillment.kind === "pickup"
      ? "Pickup is FREE. Confirm with the customer when ready."
      : "",
    fulfillment.address ? `Shipping address:\n${fulfillment.address}` : "",
    "",
    "Items:",
    itemsText || "(see Square Dashboard)",
    "",
    `Tax: ${taxText}`,
    `Total: ${totalText}`,
  ]
    .filter((line, i, arr) => !(line === "" && (i === 0 || arr[i - 1] === "")))
    .join("\n");

  const shipAddrHtml = fulfillment.address
    ? `<p><strong>Shipping address:</strong><br>${escapeEmailHtml(fulfillment.address).replace(/\\n/g, "<br>")}</p>`
    : "";
  const pickupStatusHtml =
    fulfillment.kind === "pickup"
      ? `<br><strong>Pickup status:</strong> ${escapeEmailHtml(String(fulfillment.state || "PROPOSED"))}`
      : "";

  const adminHtml = `
    <h2>NEW WILDHOUSE LANE ORDER</h2>
    <p><strong>Order #</strong>${escapeEmailHtml(orderId)}<br>
    <strong>Customer:</strong> ${escapeEmailHtml(customerName)}<br>
    <strong>Email:</strong> ${escapeEmailHtml(buyerEmail || "(collected by Square)")}</p>
    <p><strong>Fulfillment:</strong> ${escapeEmailHtml(fulfillLabel)}${pickupStatusHtml}</p>
    ${shipAddrHtml}
    <pre style="font-family:inherit">${escapeEmailHtml(itemsText)}</pre>
    <p>Tax: ${escapeEmailHtml(taxText)}<br>Total: ${escapeEmailHtml(totalText)}</p>`;

  const adminResult = await sendEmail(env, {
    to: notifyTo,
    subject: adminSubject,
    text: adminText,
    html: adminHtml,
    replyTo: buyerEmail || undefined,
  });
  if (!adminResult.ok) {
    console.error("order-notify admin email failed", adminResult.status, adminResult.error);
  }

  if (buyerEmail && fulfillment.kind === "pickup") {
    const subject = "Your Wildhouse Lane order — local pickup";
    const text = [
      "Thanks for supporting Wildhouse Lane!",
      "",
      "Your order was placed successfully and you've selected FREE local pickup.",
      "",
      `Order #${orderId}`,
      "",
      "Items:",
      itemsText,
      "",
      pickup.address
        ? `Pickup location:\n${pickup.address}`
        : "Pickup location: (Wildhouse Lane will confirm details)",
      "",
      pickup.instructions ? `Pickup instructions:\n${pickup.instructions}` : "",
      "",
      "Please wait for confirmation that your order is ready before coming to pick it up.",
      "We will contact you when it's ready.",
      "",
      pickup.contact ? `Questions?\n${pickup.contact}` : "",
    ]
      .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
      .join("\n");

    const locHtml = pickup.address
      ? `<p><strong>Pickup location:</strong><br>${escapeEmailHtml(pickup.address).replace(/\\n/g, "<br>")}</p>`
      : "";
    const instrHtml = pickup.instructions
      ? `<p><strong>Pickup instructions:</strong><br>${escapeEmailHtml(pickup.instructions).replace(/\\n/g, "<br>")}</p>`
      : "";
    const contactHtml = pickup.contact
      ? `<p>Questions?<br>${escapeEmailHtml(pickup.contact)}</p>`
      : "";

    const html = `
      <p>Thanks for supporting Wildhouse Lane!</p>
      <p>Your order was placed successfully and you've selected <strong>FREE local pickup</strong>.</p>
      <p><strong>Order #${escapeEmailHtml(orderId)}</strong></p>
      <pre style="font-family:inherit">${escapeEmailHtml(itemsText)}</pre>
      ${locHtml}
      ${instrHtml}
      <p>Please wait for confirmation that your order is ready before coming to pick it up. We will contact you when it's ready.</p>
      ${contactHtml}`;

    const cust = await sendEmail(env, { to: buyerEmail, subject, text, html });
    if (!cust.ok) {
      console.error("order-notify customer pickup email failed", cust.status, cust.error);
    }
  } else if (buyerEmail) {
    const subject = "Thanks for your Wildhouse Lane order";
    const text = [
      "Thanks for supporting Wildhouse Lane!",
      "",
      "Your order was placed successfully and will ship to the address you provided at checkout.",
      "",
      `Order #${orderId}`,
      "",
      "Items:",
      itemsText,
      "",
      `Total: ${totalText}`,
      "",
      "You'll also receive a receipt from Square.",
      notifyTo ? `Questions? ${notifyTo}` : "",
    ].join("\n");

    const cust = await sendEmail(env, {
      to: buyerEmail,
      subject,
      text,
      html: `<p>Thanks for supporting Wildhouse Lane!</p>
        <p>Your order was placed successfully and will ship to the address you provided at checkout.</p>
        <p><strong>Order #${escapeEmailHtml(orderId)}</strong></p>
        <pre style="font-family:inherit">${escapeEmailHtml(itemsText)}</pre>
        <p>Total: ${escapeEmailHtml(totalText)}</p>
        <p>You'll also receive a receipt from Square.</p>`,
    });
    if (!cust.ok) {
      console.error("order-notify customer ship email failed", cust.status, cust.error);
    }
  } else {
    console.error("order-notify: no buyer email on order", orderId);
  }

  return json({
    ok: true,
    status: "notified",
    fulfillment: fulfillment.kind,
    pickup: publicPickup,
  });
}

export async function onRequestGet() {
  return json({ error: "Method not allowed" }, 405);
}
