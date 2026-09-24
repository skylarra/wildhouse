// Shared transactional email helper (Resend).
// Server-side only — never import from browser code.
// Requires Cloudflare secrets: RESEND_API_KEY, EMAIL_FROM

import { json } from "./_square.js";

export function emailConfigured(env = {}) {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

/**
 * Send a plain-text (+ simple HTML) email via Resend.
 * Returns { ok, status, error?, id? }. Never throws for Resend HTTP errors.
 */
export async function sendEmail(env, { to, subject, text, html, replyTo }) {
  if (!env.RESEND_API_KEY) {
    return { ok: false, status: 503, error: "RESEND_API_KEY not configured" };
  }
  if (!env.EMAIL_FROM) {
    return { ok: false, status: 503, error: "EMAIL_FROM not configured" };
  }
  const recipients = Array.isArray(to) ? to : [to];
  const cleaned = recipients.map((e) => String(e || "").trim()).filter(Boolean);
  if (!cleaned.length) return { ok: false, status: 400, error: "Missing recipient" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: cleaned,
        subject: String(subject || "").slice(0, 200),
        text: String(text || ""),
        ...(html ? { html: String(html) } : {}),
        ...(replyTo ? { reply_to: String(replyTo) } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: body?.message || body?.error || res.statusText || "Resend error",
      };
    }
    return { ok: true, status: res.status, id: body?.id || null };
  } catch (err) {
    return { ok: false, status: 502, error: String(err?.message || err) };
  }
}

/** Escape untrusted strings before placing them in HTML email bodies. */
export function escapeEmailHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { json };
