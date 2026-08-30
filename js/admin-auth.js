// Shared admin session helpers — builds on the existing Bearer ADMIN_PASSWORD model.
// Session token is kept in sessionStorage (same key used by collections save).
// The real password never ships in the repo; verification is server-side only.

import { ADMIN_TOKEN_SESSION_KEY } from "./collections-config.js";

export const ADMIN_LOGIN_PATH = "/admin/login.html";

export const ADMIN_NAV_ITEMS = [
  { href: "/admin/", label: "Dashboard", match: /^\/admin\/?$/ },
  { href: "/admin/products", label: "Products", match: /\/admin\/products/ },
  { href: "/admin/collections", label: "Collections", match: /\/admin\/collections/ },
  { href: "/admin/media", label: "Media", match: /\/admin\/media/ },
  { href: "/admin/orders", label: "Orders", match: /\/admin\/orders/ },
];

export function getAdminToken() {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY) || "";
  } catch (_) {
    return "";
  }
}

export function setAdminToken(token) {
  try {
    if (token) sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, String(token));
    else sessionStorage.removeItem(ADMIN_TOKEN_SESSION_KEY);
  } catch (_) {
    /* private mode */
  }
}

export function clearAdminSession() {
  setAdminToken("");
}

export function isAdminLoggedIn() {
  return Boolean(getAdminToken());
}

/** Authorization header value for existing admin APIs (collections-config PUT, etc.). */
export function adminAuthHeader() {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Verify password against Cloudflare ADMIN_PASSWORD via /api/admin-auth.
 * On success, stores the session token (same Bearer value the save APIs already use).
 */
export async function loginWithPassword(password) {
  const trimmed = String(password || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Incorrect password" };
  }

  let res;
  try {
    res = await fetch("/api/admin-auth", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${trimmed}`,
        Accept: "application/json",
      },
    });
  } catch (_) {
    return {
      ok: false,
      error: "Could not reach admin auth. Is the site running with Cloudflare Pages Functions?",
    };
  }

  if (res.ok) {
    setAdminToken(trimmed);
    return { ok: true };
  }

  if (res.status === 401) {
    clearAdminSession();
    return { ok: false, error: "Incorrect password" };
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 503) {
    return {
      ok: false,
      error: data.error || "Admin password is not configured on the server.",
    };
  }
  return { ok: false, error: data.error || "Incorrect password" };
}

export function logoutAdmin({ redirect = true } = {}) {
  clearAdminSession();
  if (redirect) {
    const url = `${ADMIN_LOGIN_PATH}?loggedOut=1`;
    // Replace so Back cannot resurrect a protected page from history cache alone.
    location.replace(url);
  }
}

/**
 * Gate a protected admin page. Redirects to login when no session token.
 * Re-checks on pageshow (bfcache / back-forward).
 * @returns {boolean} true if the page may continue rendering
 */
export function requireAdmin() {
  const enforce = () => {
    if (isAdminLoggedIn()) return true;
    const next = `${location.pathname}${location.search}`;
    const params = new URLSearchParams();
    if (next && next !== ADMIN_LOGIN_PATH) params.set("next", next);
    location.replace(`${ADMIN_LOGIN_PATH}${params.toString() ? `?${params}` : ""}`);
    return false;
  };

  window.addEventListener("pageshow", (e) => {
    if (e.persisted || isAdminLoggedIn() === false) enforce();
  });

  return enforce();
}

/** Mount shared admin chrome: nav links + LOG OUT. */
export function mountAdminChrome({ current = "" } = {}) {
  const nav = document.querySelector(".admin-nav");
  if (!nav) return;

  const path = current || location.pathname;
  const links = ADMIN_NAV_ITEMS.map((item) => {
    const active = item.match.test(path);
    return `<a href="${item.href}"${active ? ' aria-current="page"' : ""}>${item.label}</a>`;
  }).join("");

  nav.innerHTML = `
    <a class="admin-brand" href="/index.html">← Storefront</a>
    <div class="admin-nav__links">${links}</div>
    <button type="button" class="admin-logout-btn" id="admin-logout">Log out</button>
  `;

  document.getElementById("admin-logout")?.addEventListener("click", () => {
    logoutAdmin({ redirect: true });
  });
}
