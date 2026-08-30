// Admin login page — verifies against Cloudflare ADMIN_PASSWORD via /api/admin-auth.
import {
  isAdminLoggedIn,
  loginWithPassword,
  ADMIN_LOGIN_PATH,
} from "./admin-auth.js";

const form = document.getElementById("admin-login-form");
const statusEl = document.getElementById("admin-login-status");
const passwordEl = document.getElementById("admin-password");
const submitBtn = document.getElementById("admin-login-submit");

function setStatus(msg, kind = "") {
  if (!statusEl) return;
  statusEl.textContent = msg || "";
  statusEl.className = `admin-status${kind ? ` is-${kind}` : ""}`;
}

function safeNext() {
  const next = new URLSearchParams(location.search).get("next") || "/admin/";
  // Only allow same-origin admin paths.
  if (!next.startsWith("/admin")) return "/admin/";
  if (next.startsWith(ADMIN_LOGIN_PATH)) return "/admin/";
  return next;
}

async function onSubmit(e) {
  e.preventDefault();
  const password = passwordEl?.value || "";
  if (submitBtn) submitBtn.disabled = true;
  setStatus("Checking…");

  const result = await loginWithPassword(password);
  if (result.ok) {
    setStatus("Logged in.", "ok");
    location.replace(safeNext());
    return;
  }

  if (passwordEl) {
    passwordEl.value = "";
    passwordEl.focus();
  }
  setStatus(result.error || "Incorrect password", "error");
  if (submitBtn) submitBtn.disabled = false;
}

function init() {
  if (isAdminLoggedIn()) {
    location.replace(safeNext());
    return;
  }
  if (new URLSearchParams(location.search).get("loggedOut") === "1") {
    setStatus("You have been logged out.", "ok");
  }
  form?.addEventListener("submit", onSubmit);
  passwordEl?.focus();
}

init();
