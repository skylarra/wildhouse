// Admin · Collections — visibility, featured, order, presentation copy/images.
// Square Collection attribute remains the membership source of truth.
// Persistence: PUT /api/collections-config → Cloudflare KV (COLLECTIONS_CONFIG).
import { getAllCollectionRecords, clearCollectionsMetaCache } from "./catalog.js";
import {
  toSavableConfig,
  ADMIN_TOKEN_SESSION_KEY,
} from "./collections-config.js";
import { collectionCoverFilename } from "./collection-assets.js";
import { escapeHtml } from "./ui.js";

const gate = document.getElementById("admin-gate");
const app = document.getElementById("admin-app");
const listEl = document.getElementById("admin-list");
const statusEl = document.getElementById("admin-status");
const gateStatus = document.getElementById("admin-gate-status");

/** @type {ReturnType<typeof normalizeRow>[]} */
let rows = [];
let dragKey = null;
let kvConfigured = null;
let localPreview = false;
let dirty = false;

function normalizeRow(r) {
  return {
    collectionKey: r.collectionKey || r.handle,
    displayName: r.displayName || r.name,
    name: r.name || r.displayName,
    productCount: r.productCount || r.count || 0,
    visible: Boolean(r.visible),
    featured: Boolean(r.featured),
    sortOrder: Number(r.sortOrder) || 0,
    description: r.description || "",
    heroImage: r.heroImage || "",
    featuredImage: r.featuredImage || "",
    isNew: Boolean(r.isNew),
  };
}

function setStatus(msg, kind = "") {
  if (!statusEl) return;
  statusEl.textContent = msg || "";
  statusEl.className = `admin-status${kind ? ` is-${kind}` : ""}`;
}

function getToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY) || "";
}

function setToken(token) {
  if (token) sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, token);
  else sessionStorage.removeItem(ADMIN_TOKEN_SESSION_KEY);
}

function reindexOrder() {
  rows.forEach((r, i) => {
    r.sortOrder = i + 1;
  });
}

function markDirty() {
  dirty = true;
  const saveBtn = document.getElementById("admin-save");
  if (saveBtn) saveBtn.disabled = false;
}

function visibilityLabel(visible) {
  return visible ? "VISIBLE" : "HIDDEN";
}

function render() {
  if (!listEl) return;
  if (!rows.length) {
    listEl.innerHTML = `<p class="empty-state__body">No collections detected yet. In Square, create a custom attribute named <strong>Collection</strong> (single selection), add your collection options, assign products, then reload.</p>`;
    return;
  }

  listEl.innerHTML = rows
    .map((r) => {
      const countNote =
        r.productCount === 0
          ? `<span class="admin-row__note">0 products · stays off the public site</span>`
          : `<span class="admin-row__note">${r.productCount} ${r.productCount === 1 ? "product" : "products"}</span>`;
      const newNote = r.isNew
        ? `<span class="admin-row__note admin-row__note--new">New from Square · defaults hidden</span>`
        : "";
      const featuredNote = r.featured
        ? `<span class="admin-row__note admin-row__note--featured">Featured on homepage</span>`
        : "";
      return `
      <article class="admin-row" draggable="true" data-key="${escapeHtml(r.collectionKey)}">
        <div class="admin-row__handle" title="Drag to reorder" aria-hidden="true">☰</div>
        <div class="admin-row__main">
          <div class="admin-row__summary">
            <h2 class="admin-row__title">
              <span class="admin-row__name">${escapeHtml(r.displayName || r.name)}</span>
              <span class="admin-row__sep" aria-hidden="true">—</span>
              <button type="button"
                class="admin-vis-btn${r.visible ? " is-on" : ""}"
                data-action="toggle-visible"
                aria-pressed="${r.visible}"
                aria-label="${r.visible ? "Hide" : "Show"} ${escapeHtml(r.displayName || r.name)}">
                ${visibilityLabel(r.visible)}
              </button>
              <button type="button"
                class="admin-feat-btn${r.featured ? " is-on" : ""}"
                data-action="toggle-featured"
                aria-pressed="${r.featured}"
                aria-label="${r.featured ? "Unfeature" : "Feature"} ${escapeHtml(r.displayName || r.name)}"
                ${!r.visible ? "disabled" : ""}>
                ${r.featured ? "FEATURED" : "NOT FEATURED"}
              </button>
            </h2>
            <p class="admin-row__meta">${countNote}${featuredNote}${newNote}</p>
            <p class="admin-row__order">Display order: <strong>${r.sortOrder}</strong></p>
          </div>
          <details class="admin-row__details">
            <summary>Edit presentation</summary>
            <div class="admin-row__fields">
              <p class="admin-row__note">Cover image file: <code>assets/collections/${escapeHtml(collectionCoverFilename(r.displayName || r.name) || "…")}</code> — add/replace the PNG in the repo; names come from Square.</p>
              <label class="field">
                <span>Description (optional website copy)</span>
                <textarea data-field="description" rows="3">${escapeHtml(r.description)}</textarea>
              </label>
            </div>
          </details>
        </div>
      </article>`;
    })
    .join("");
}

function rowFromEvent(e) {
  const article = e.target.closest(".admin-row");
  if (!article) return null;
  const key = article.dataset.key;
  return rows.find((r) => r.collectionKey === key) || null;
}

function wireList() {
  listEl.addEventListener("click", (e) => {
    const row = rowFromEvent(e);
    if (!row) return;

    if (e.target.closest('[data-action="toggle-visible"]')) {
      row.visible = !row.visible;
      if (!row.visible) row.featured = false;
      markDirty();
      render();
      return;
    }

    if (e.target.closest('[data-action="toggle-featured"]')) {
      if (!row.visible) return;
      row.featured = !row.featured;
      if (row.featured) row.visible = true;
      markDirty();
      render();
    }
  });

  listEl.addEventListener("input", (e) => {
    const field = e.target.closest("[data-field]");
    if (!field) return;
    const row = rowFromEvent(e);
    if (!row) return;
    const key = field.dataset.field;
    if (key === "description") {
      row[key] = field.value;
      markDirty();
    }
  });

  listEl.addEventListener("dragstart", (e) => {
    if (e.target.closest("button, input, a, label, textarea, details, summary")) {
      e.preventDefault();
      return;
    }
    const article = e.target.closest(".admin-row");
    if (!article) return;
    dragKey = article.dataset.key;
    article.classList.add("is-dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  listEl.addEventListener("dragend", (e) => {
    const article = e.target.closest(".admin-row");
    article?.classList.remove("is-dragging");
    dragKey = null;
  });
  listEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    const over = e.target.closest(".admin-row");
    if (!over || !dragKey || over.dataset.key === dragKey) return;
    const from = rows.findIndex((r) => r.collectionKey === dragKey);
    const to = rows.findIndex((r) => r.collectionKey === over.dataset.key);
    if (from < 0 || to < 0 || from === to) return;
    const [item] = rows.splice(from, 1);
    rows.splice(to, 0, item);
    reindexOrder();
    markDirty();
    render();
  });
}

async function probeKv() {
  try {
    const res = await fetch("/api/collections-config", { cache: "no-store" });
    if (!res.ok) {
      kvConfigured = false;
      return;
    }
    const data = await res.json();
    kvConfigured = Boolean(data?._meta?.kvConfigured || data?._meta?.source === "kv");
  } catch (_) {
    kvConfigured = false;
  }
}

async function loadRows() {
  setStatus("Loading collections…");
  clearCollectionsMetaCache();
  await probeKv();
  const all = await getAllCollectionRecords();
  rows = all.map(normalizeRow);
  reindexOrder();
  dirty = false;
  render();

  if (localPreview) {
    setStatus(
      `${rows.length} collections loaded (local preview — Save Changes needs Wrangler + KV).`,
      "warn"
    );
  } else if (kvConfigured === false) {
    setStatus(
      `${rows.length} collections loaded. Cloudflare KV (COLLECTIONS_CONFIG) is not bound — Save Changes will not persist until it is configured.`,
      "error"
    );
  } else {
    setStatus(`${rows.length} collections loaded.`, "ok");
  }
}

function downloadConfig() {
  const config = toSavableConfig(rows);
  const blob = new Blob([JSON.stringify(config, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "collections.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function save() {
  reindexOrder();
  const config = toSavableConfig(rows);
  const token = getToken();

  if (localPreview && !token) {
    setStatus(
      "Local preview cannot write to Cloudflare KV. Unlock with ADMIN_PASSWORD under Wrangler, or use Developer fallback → Download JSON.",
      "error"
    );
    return;
  }

  if (!token) {
    setStatus("Unlock with the admin password before saving.", "error");
    showGate();
    return;
  }

  setStatus("Saving to Cloudflare KV…");
  const saveBtn = document.getElementById("admin-save");
  if (saveBtn) saveBtn.disabled = true;

  try {
    const res = await fetch("/api/collections-config", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(config),
    });

    if (res.ok) {
      clearCollectionsMetaCache();
      dirty = false;
      kvConfigured = true;
      setStatus("Saved. Collection presentation is live on the public site.", "ok");
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setStatus("Unauthorized — unlock with the correct admin password.", "error");
      setToken("");
      showGate();
      return;
    }
    if (res.status === 503 || res.status === 404) {
      setStatus(
        `${data.error || "Save unavailable"}. ${data.hint || "Set ADMIN_PASSWORD and bind KV namespace COLLECTIONS_CONFIG in Cloudflare Pages."}`,
        "error"
      );
      return;
    }
    setStatus(data.error || `Save failed (${res.status})`, "error");
  } catch (_) {
    setStatus(
      "Could not reach /api/collections-config. Is the site running with Cloudflare Pages Functions (Wrangler)?",
      "error"
    );
  } finally {
    if (saveBtn) saveBtn.disabled = !dirty;
  }
}

function showGate() {
  gate.hidden = false;
  app.hidden = true;
}

function showApp() {
  gate.hidden = true;
  app.hidden = false;
}

function wireChrome() {
  document.getElementById("admin-unlock-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const password = document.getElementById("admin-password").value;
    if (!password.trim()) {
      gateStatus.textContent = "Enter the admin password.";
      gateStatus.className = "admin-status is-error";
      return;
    }
    setToken(password);
    localPreview = false;
    gateStatus.textContent = "Unlocked.";
    gateStatus.className = "admin-status is-ok";
    showApp();
    loadRows();
  });

  document.getElementById("admin-continue-local")?.addEventListener("click", () => {
    setToken("");
    localPreview = true;
    gateStatus.textContent = "Local preview — changes will not save to KV.";
    gateStatus.className = "admin-status is-warn";
    showApp();
    loadRows();
  });

  document.getElementById("admin-save")?.addEventListener("click", () => save());
  document.getElementById("admin-export")?.addEventListener("click", () => downloadConfig());
  document.getElementById("admin-reload")?.addEventListener("click", () => loadRows());
}

async function init() {
  wireChrome();
  wireList();
  if (getToken()) {
    localPreview = false;
    showApp();
    await loadRows();
  } else {
    showGate();
  }
}

init();
