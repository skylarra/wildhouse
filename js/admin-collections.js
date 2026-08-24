// Admin · Collections — visibility, featured, order, presentation.
// Square Collection attribute remains membership source of truth.
import { getAllCollectionRecords, clearCollectionsMetaCache } from "./catalog.js";
import {
  toSavableConfig,
  COLLECTIONS_CONFIG_LS_KEY,
  ADMIN_TOKEN_SESSION_KEY,
} from "./collections-config.js";
import { escapeHtml } from "./ui.js";

const gate = document.getElementById("admin-gate");
const app = document.getElementById("admin-app");
const listEl = document.getElementById("admin-list");
const statusEl = document.getElementById("admin-status");
const gateStatus = document.getElementById("admin-gate-status");
const dialog = document.getElementById("admin-edit-dialog");

/** @type {ReturnType<typeof normalizeRow>[]} */
let rows = [];
let dragKey = null;

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
    image: r.image || "",
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

function render() {
  if (!listEl) return;
  if (!rows.length) {
    listEl.innerHTML = `<p class="empty-state__body">No collections detected yet. Assign the Square <strong>Collection</strong> attribute on products, then reload.</p>`;
    return;
  }

  listEl.innerHTML = rows
    .map((r) => {
      const badges = [
        r.isNew ? `<span class="admin-badge admin-badge--new">New · defaults hidden</span>` : "",
        r.productCount === 0 ? `<span class="admin-badge admin-badge--empty">0 products · public hide</span>` : "",
      ]
        .filter(Boolean)
        .join("");
      return `
      <article class="admin-row" draggable="true" data-key="${escapeHtml(r.collectionKey)}">
        <div class="admin-row__handle" aria-hidden="true">⠿</div>
        <div class="admin-row__main">
          <h2 class="admin-row__title">${escapeHtml(r.displayName || r.name)}</h2>
          <p class="admin-row__meta">${r.productCount} ${r.productCount === 1 ? "product" : "products"} · key <code>${escapeHtml(r.collectionKey)}</code></p>
          ${badges ? `<div class="admin-row__badges">${badges}</div>` : ""}
        </div>
        <div class="admin-row__controls">
          <label class="admin-toggle">
            <input type="checkbox" data-action="visible" ${r.visible ? "checked" : ""}>
            <span>Visible ${r.visible ? "ON" : "OFF"}</span>
          </label>
          <label class="admin-toggle">
            <input type="checkbox" data-action="featured" ${r.featured ? "checked" : ""}>
            <span>Featured ${r.featured ? "ON" : "OFF"}</span>
          </label>
          <label class="admin-order">
            <span>Order</span>
            <input type="number" min="1" step="1" data-action="sortOrder" value="${r.sortOrder}">
          </label>
          <button type="button" class="btn" data-action="edit">Edit →</button>
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
  listEl.addEventListener("change", (e) => {
    const row = rowFromEvent(e);
    if (!row) return;
    const input = e.target.closest("[data-action]");
    if (!input) return;
    const action = input.dataset.action;
    if (action === "visible") {
      row.visible = input.checked;
      // Featured cannot publish a hidden collection.
      if (!row.visible) row.featured = false;
    } else if (action === "featured") {
      row.featured = input.checked;
      if (row.featured) row.visible = true;
    } else if (action === "sortOrder") {
      row.sortOrder = Math.max(1, Number(input.value) || 1);
      rows.sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName));
      reindexOrder();
    }
    render();
  });

  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="edit"]');
    if (!btn) return;
    const row = rowFromEvent(e);
    if (!row) return;
    openEdit(row);
  });

  listEl.addEventListener("dragstart", (e) => {
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
    render();
  });
}

function openEdit(row) {
  document.getElementById("edit-key").value = row.collectionKey;
  document.getElementById("edit-display-name").textContent = row.displayName || row.name;
  document.getElementById("edit-description").value = row.description || "";
  document.getElementById("edit-hero").value = row.heroImage || "";
  document.getElementById("edit-featured-image").value = row.featuredImage || "";
  dialog.showModal();
}

function wireDialog() {
  const form = document.getElementById("admin-edit-form");
  form.addEventListener("submit", (e) => {
    const submitter = e.submitter;
    if (submitter?.value === "cancel") return;
    e.preventDefault();
    const key = document.getElementById("edit-key").value;
    const row = rows.find((r) => r.collectionKey === key);
    if (row) {
      row.description = document.getElementById("edit-description").value.trim();
      row.heroImage = document.getElementById("edit-hero").value.trim();
      row.featuredImage = document.getElementById("edit-featured-image").value.trim();
      setStatus(`Updated details for ${row.displayName}. Remember to Save.`, "ok");
    }
    dialog.close();
    render();
  });
}

async function loadRows() {
  setStatus("Loading collections…");
  clearCollectionsMetaCache();
  const all = await getAllCollectionRecords();
  rows = all.map(normalizeRow);
  reindexOrder();
  render();
  setStatus(`${rows.length} collection${rows.length === 1 ? "" : "s"} loaded.`, "ok");
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
  setStatus("Saving…");

  // Always keep a local draft so static preview reflects changes immediately.
  try {
    localStorage.setItem(COLLECTIONS_CONFIG_LS_KEY, JSON.stringify(config));
  } catch (_) {
    /* ignore quota */
  }
  clearCollectionsMetaCache();

  const token = getToken();
  try {
    const res = await fetch("/api/collections-config", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(config),
    });
    if (res.ok) {
      setStatus("Saved to live config (KV). Public site will pick this up on next load.", "ok");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 503 || res.status === 404) {
      setStatus(
        `${data.error || "Live API unavailable"}. Draft saved in this browser — use Download JSON to update content/collections.json, or configure ADMIN_PASSWORD + COLLECTIONS_CONFIG KV.`,
        "error"
      );
      return;
    }
    if (res.status === 401) {
      setStatus("Unauthorized — unlock with the correct admin password.", "error");
      showGate();
      return;
    }
    setStatus(data.error || `Save failed (${res.status})`, "error");
  } catch (_) {
    setStatus(
      "Could not reach /api/collections-config. Draft saved in this browser — Download JSON to commit content/collections.json.",
      "error"
    );
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
    setToken(password);
    gateStatus.textContent = "Unlocked.";
    showApp();
    loadRows();
  });
  document.getElementById("admin-continue-local")?.addEventListener("click", () => {
    setToken("");
    gateStatus.textContent = "Local mode — saves use this browser + JSON download.";
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
  wireDialog();
  // If a token already exists (or local draft), go straight in.
  if (getToken() || localStorage.getItem(COLLECTIONS_CONFIG_LS_KEY)) {
    showApp();
    await loadRows();
  } else {
    showGate();
  }
}

init();
