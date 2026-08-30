// POST /api/admin-auth — verify admin session token (Bearer === ADMIN_PASSWORD).
// Does not store secrets; only confirms the existing Cloudflare env password.
import { json } from "./_square.js";
import { checkAdmin } from "./_admin-auth.js";

export async function onRequestPost({ request, env }) {
  const auth = checkAdmin(request, env);
  if (!auth.ok) {
    if (auth.reason === "ADMIN_PASSWORD not configured") {
      return json(
        {
          error: "Admin login requires ADMIN_PASSWORD.",
          hint: "Set ADMIN_PASSWORD in Cloudflare Pages → Settings → Environment variables.",
          adminConfigured: false,
        },
        503
      );
    }
    // Generic failure — never reveal whether password was close.
    return json({ error: "Incorrect password", ok: false }, 401);
  }
  return json({ ok: true, adminConfigured: true });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}
