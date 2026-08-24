// GET/PUT /api/collections-config
// Website-side collection visibility & presentation settings.
// - GET: KV override if present, else seed from /content/collections.json
// - PUT: requires Authorization: Bearer <ADMIN_PASSWORD>; writes to KV binding COLLECTIONS_CONFIG
import { json } from "./_square.js";
import { normalizeCollectionsConfig, KV_KEY } from "./_collections-config.js";

async function loadSeed(request, env) {
  try {
    const url = new URL("/content/collections.json", request.url);
    const res = env.ASSETS
      ? await env.ASSETS.fetch(url)
      : await fetch(url.toString());
    if (!res.ok) return { version: 2, entries: [] };
    return normalizeCollectionsConfig(await res.json());
  } catch (_) {
    return { version: 2, entries: [] };
  }
}

async function loadConfig(request, env) {
  if (env.COLLECTIONS_CONFIG) {
    try {
      const stored = await env.COLLECTIONS_CONFIG.get(KV_KEY, "json");
      if (stored && Array.isArray(stored.entries)) {
        return {
          ...normalizeCollectionsConfig(stored),
          _meta: { source: "kv" },
        };
      }
    } catch (_) {
      /* fall through to seed */
    }
  }
  const seed = await loadSeed(request, env);
  return { ...seed, _meta: { source: "seed", kvConfigured: Boolean(env.COLLECTIONS_CONFIG) } };
}

function unauthorized() {
  return json({ error: "Unauthorized" }, 401);
}

function checkAdmin(request, env) {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) return { ok: false, reason: "ADMIN_PASSWORD not configured" };
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token !== expected) return { ok: false, reason: "bad token" };
  return { ok: true };
}

export async function onRequestGet({ request, env }) {
  const config = await loadConfig(request, env);
  return json(config);
}

export async function onRequestPut({ request, env }) {
  const auth = checkAdmin(request, env);
  if (!auth.ok) {
    if (auth.reason === "ADMIN_PASSWORD not configured") {
      return json(
        {
          error: "Admin writes require ADMIN_PASSWORD and COLLECTIONS_CONFIG KV binding.",
          hint: "Set ADMIN_PASSWORD in Cloudflare Pages env and bind a KV namespace as COLLECTIONS_CONFIG.",
        },
        503
      );
    }
    return unauthorized();
  }

  if (!env.COLLECTIONS_CONFIG) {
    return json(
      {
        error: "COLLECTIONS_CONFIG KV binding is not configured.",
        hint: "Add a KV namespace binding named COLLECTIONS_CONFIG in Cloudflare Pages → Settings → Functions.",
      },
      503
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const normalized = normalizeCollectionsConfig(body);
  if (!normalized.entries.length && !Array.isArray(body.entries)) {
    return json({ error: "Body must include an entries array" }, 400);
  }

  await env.COLLECTIONS_CONFIG.put(KV_KEY, JSON.stringify(normalized));
  return json({ ...normalized, _meta: { source: "kv", saved: true } });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, PUT, OPTIONS",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}
