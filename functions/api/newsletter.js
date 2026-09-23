// POST /api/newsletter
// Body: { email: string, source?: string }
// Saves a marketing subscriber to KV (EMAIL_SUBSCRIBERS) and emails skylar@
// on NEW subscriptions only. Never returns subscriber data to the browser.
//
// Bindings / secrets (Cloudflare Pages → Settings):
//   EMAIL_SUBSCRIBERS  (KV namespace binding)
//   RESEND_API_KEY     (secret)
//   EMAIL_FROM         (e.g. "Wildhouse Lane <hello@wildhouselane.com>")
//   NEWSLETTER_NOTIFY_TO (optional, default skylar@wildhouselane.com)

import { json } from "./_square.js";
import { sendEmail, escapeEmailHtml, emailConfigured } from "./_email.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 2_048;
const RATE_LIMIT_PER_HOUR = 8;
const DEFAULT_NOTIFY_TO = "skylar@wildhouselane.com";

function normalizeEmail(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase();
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

async function underRateLimit(kv, request) {
  if (!kv) return { ok: true };
  const ip = clientIp(request);
  const ipHash = (await sha256Hex(ip)).slice(0, 32);
  const key = `rate:${ipHash}`;
  const current = parseInt((await kv.get(key)) || "0", 10) || 0;
  if (current >= RATE_LIMIT_PER_HOUR) return { ok: false };
  await kv.put(key, String(current + 1), { expirationTtl: 60 * 60 });
  return { ok: true };
}

export async function onRequestPost({ request, env }) {
  // Size guard
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY_BYTES) return json({ error: "Request too large", code: "too_large" }, 413);

  const kv = env.EMAIL_SUBSCRIBERS;
  if (!kv) {
    return json(
      {
        error: "Email list is not configured",
        code: "kv_missing",
        hint: "Bind a KV namespace named EMAIL_SUBSCRIBERS to this Pages project.",
      },
      503
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid request", code: "bad_json" }, 400);
  }

  const email = normalizeEmail(payload?.email);
  if (!email || !EMAIL_RE.test(email)) {
    return json({ error: "Please enter a valid email address.", code: "invalid_email" }, 400);
  }

  // Header-injection hard stop (defense in depth; we never put this in headers anyway)
  if (/[\r\n]/.test(email)) {
    return json({ error: "Please enter a valid email address.", code: "invalid_email" }, 400);
  }

  const rate = await underRateLimit(kv, request);
  if (!rate.ok) {
    return json({ error: "Too many requests. Please try again later.", code: "rate_limited" }, 429);
  }

  const emailHash = await sha256Hex(email);
  const key = `sub:${emailHash}`;
  const existingRaw = await kv.get(key);

  if (existingRaw) {
    // Already subscribed — success for the customer, no owner notification.
    return json({ ok: true, status: "already_subscribed" });
  }

  const record = {
    email,
    emailHash,
    joinedAt: new Date().toISOString(),
    source: "website",
    status: "subscribed",
  };

  try {
    await kv.put(key, JSON.stringify(record));
  } catch (err) {
    console.error("newsletter KV put failed", String(err?.message || err));
    return json({ error: "Something went wrong. Please try again.", code: "kv_error" }, 500);
  }

  // Notify owner — failure must NOT undo the subscription.
  if (emailConfigured(env)) {
    const notifyTo = env.NEWSLETTER_NOTIFY_TO || DEFAULT_NOTIFY_TO;
    const joined = new Date(record.joinedAt).toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "medium",
      timeStyle: "short",
    });
    const text = [
      "Someone just joined the Wildhouse Lane email list.",
      "",
      `Email: ${email}`,
      `Joined: ${joined}`,
      "Source: Website",
    ].join("\n");
    const html = `
      <p>Someone just joined the Wildhouse Lane email list.</p>
      <p><strong>Email:</strong> ${escapeEmailHtml(email)}<br>
      <strong>Joined:</strong> ${escapeEmailHtml(joined)}<br>
      <strong>Source:</strong> Website</p>`;
    const notify = await sendEmail(env, {
      to: notifyTo,
      subject: "New Wildhouse Lane Subscriber",
      text,
      html,
    });
    if (!notify.ok) {
      console.error("newsletter notify failed", notify.status, notify.error);
    }
  } else {
    console.error("newsletter notify skipped — RESEND_API_KEY or EMAIL_FROM missing");
  }

  return json({ ok: true, status: "subscribed" }, 201);
}

// Reject non-POST explicitly if someone hits the route wrong.
export async function onRequestGet() {
  return json({ error: "Method not allowed" }, 405);
}
