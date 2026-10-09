// Admin · Sale / Promo — announcement banner + sitewide % off.
// Persistence: PUT /api/site-promo → COLLECTIONS_CONFIG KV key `site-promo`.
import {
  requireAdmin,
  mountAdminChrome,
  getAdminToken,
  clearAdminSession,
  adminAuthHeader,
  logoutAdmin,
} from "./admin-auth.js";
import { normalizeSitePromo, promoBannerText } from "./site-promo.js";
import { escapeHtml } from "./ui.js";

if (!requireAdmin()) {
  /* redirected */
} else {
  mountAdminChrome();
  boot();
}

const form = document.getElementById("promo-form");
const statusEl = document.getElementById("admin-status");
const enabledEl = document.getElementById("promo-enabled");
const bannerEl = document.getElementById("promo-banner");
const codeEl = document.getElementById("promo-code");
const percentEl = document.getElementById("promo-percent");
const previewEl = document.getElementById("promo-preview");
const saveBtn = document.getElementById("promo-save");

function setStatus(msg, kind = "") {
  if (!statusEl) return;
  statusEl.textContent = msg || "";
  statusEl.className = `admin-status${kind ? ` is-${kind}` : ""}`;
}

function readForm() {
  return normalizeSitePromo({
    enabled: Boolean(enabledEl?.checked),
    bannerMessage: bannerEl?.value || "",
    promoCode: codeEl?.value || "",
    discountPercent: percentEl?.value || 0,
  });
}

function fillForm(promo) {
  if (enabledEl) enabledEl.checked = Boolean(promo.enabled);
  if (bannerEl) bannerEl.value = promo.bannerMessage || "";
  if (codeEl) codeEl.value = promo.promoCode || "";
  if (percentEl) percentEl.value = String(promo.discountPercent || 0);
  updatePreview();
}

function updatePreview() {
  if (!previewEl) return;
  const promo = readForm();
  if (!promo.enabled) {
    previewEl.innerHTML = `<strong>Preview:</strong> Sale is off — the normal announcement messages from <code>content/site.json</code> will show.`;
    return;
  }
  const text = promoBannerText(promo);
  const priceNote =
    promo.discountPercent > 0
      ? ` Prices show ${promo.discountPercent}% off with strikethrough.`
      : " No price markdown (discount percent is 0).";
  previewEl.innerHTML = `<strong>Preview banner:</strong> ${escapeHtml(text)}.${priceNote}`;
}

async function load() {
  setStatus("Loading…");
  try {
    const res = await fetch("/api/site-promo", { headers: { Accept: "application/json" } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data.error || "Could not load promo settings.", "error");
      fillForm(normalizeSitePromo({}));
      return;
    }
    fillForm(normalizeSitePromo(data));
    const kv = data._meta?.kvConfigured;
    setStatus(
      kv === false
        ? "Loaded defaults. KV (COLLECTIONS_CONFIG) is not bound — Save will not persist."
        : "Loaded.",
      kv === false ? "warn" : ""
    );
  } catch (err) {
    console.error(err);
    setStatus("Could not load promo settings.", "error");
    fillForm(normalizeSitePromo({}));
  }
}

async function save(e) {
  e?.preventDefault();
  const token = getAdminToken();
  if (!token) {
    clearAdminSession();
    logoutAdmin({ redirect: true });
    return;
  }

  const promo = readForm();
  if (promo.enabled && !promoBannerText(promo)) {
    setStatus("Add a banner message, discount percent, or promo code before enabling.", "error");
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
  }
  setStatus("Saving…");

  try {
    const res = await fetch("/api/site-promo", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...adminAuthHeader(),
      },
      body: JSON.stringify(promo),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearAdminSession();
      logoutAdmin({ redirect: true });
      return;
    }
    if (!res.ok) {
      setStatus(
        `${data.error || "Save failed"}. ${data.hint || ""}`.trim(),
        "error"
      );
      return;
    }
    fillForm(normalizeSitePromo(data));
    setStatus("Saved. Storefront will pick this up on the next page load.", "ok");
  } catch (err) {
    console.error(err);
    setStatus("Save failed — check your connection and try again.", "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  }
}

function boot() {
  form?.addEventListener("submit", save);
  document.getElementById("promo-reload")?.addEventListener("click", () => load());
  [enabledEl, bannerEl, codeEl, percentEl].forEach((el) => {
    el?.addEventListener("input", updatePreview);
    el?.addEventListener("change", updatePreview);
  });
  load();
}
