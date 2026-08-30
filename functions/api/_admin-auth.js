// Shared admin auth for Cloudflare Pages Functions.
// Same rule as collections-config PUT: Authorization Bearer must equal ADMIN_PASSWORD.
// Never put ADMIN_PASSWORD in KV or client bundles — only compare at request time.

export function checkAdmin(request, env) {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) return { ok: false, reason: "ADMIN_PASSWORD not configured" };
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token !== expected) return { ok: false, reason: "bad token" };
  return { ok: true };
}

export function unauthorizedJson(json) {
  return json({ error: "Unauthorized" }, 401);
}
