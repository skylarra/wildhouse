// Admin · Collections — presentation controls over Square-derived collections.
// Names + membership: Square Collection custom attribute (same as /collections).
// Covers: assets/collections/{normalizeCollectionKey}.png
// Persistence: PUT /api/collections-config → Cloudflare KV (COLLECTIONS_CONFIG).
import { getAllCollectionRecords, getCollections, clearCollectionsMetaCache } from "./catalog.js";
import {
  toSavableConfig,
  ADMIN_TOKEN_SESSION_KEY,
} from "./collections-config.js";
import {
  collectionCoverFilename,
  collectionCoverRepoPath,
  collectionCoverSrc,
  COLLECTION_COVER_FALLBACK,
  probeCollectionCover,
} from "./collection-assets.js";
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
  const name = r.name || r.displayName || "";
  return {
    collectionKey: r.collectionKey || r.handle,
    displayName: name,
    name,
    productCount: r.productCount || r.count || 0,
    visible: Boolean(r.visible),
    featured: Boolean(r.featured),
    sortOrder: Number(r.sortOrder) || 0,
    description: r.description || "",
    image: r.image || collectionCoverSrc(name),
    coverRepoPath: collectionCoverRepoPath(name),
    coverFilename: collectionCoverFilename(name),
    coverFound: null, // filled async after render
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

function coverStatusHTML(r) {
  if (r.coverFound === true) {
    return `<span class="admin-cover-status is-found">Cover found</span>`;
  }
  if (r.coverFound === false) {
    return `<span class="admin-cover-status is-missing">Missing cover</span>`;
  }
  return `<span class="admin-cover-status">Checking cover…</span>`;
}

function render() {
  if (!listEl) return;
  if (!rows.length) {
    listEl.innerHTML = `<p class="empty-state__body">No Square collections detected yet. Assign the <strong>Collection</strong> custom attribute on products (same source as <a href="/collections">/collections</a>), then reload.</p>`;
    return;
  }

  listEl.innerHTML = rows
    .map((r) => {
      const countLabel =
        r.productCount === 0
          ? `0 products · not on public /collections yet`
          : `${r.productCount} ${r.productCount === 1 ? "product" : "products"}`;
      const newNote = r.isNew
        ? `<span class="admin-row__note admin-row__note--new">New from Square</span>`
        : "";
      const thumbSrc = r.coverFound === false ? COLLECTION_COVER_FALLBACK : r.image;
      return `
      <article class="admin-row" draggable="true" data-key="${escapeHtml(r.collectionKey)}">
        <div class="admin-row__handle" title="Drag to reorder" aria-hidden="true">☰</div>
        <div class="admin-row__main">
          <div class="admin-row__summary">
            <div class="admin-row__cover">
              <img src="${escapeHtml(thumbSrc)}" alt="" width="72" height="90"
                data-cover-key="${escapeHtml(r.collectionKey)}"
                data-fallback="${COLLECTION_COVER_FALLBACK}"
                loading="lazy">
            </div>
            <div class="admin-row__text">
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
              <p class="admin-row__meta">
                <span class="admin-row__note">${escapeHtml(countLabel)}</span>
                ${newNote}
              </p>
              <p class="admin-row__order">Display order: <strong>${r.sortOrder}</strong></p>
              <div class="admin-cover-meta">
                <p><span class="admin-cover-label">Cover image:</span> <code>${escapeHtml(r.coverRepoPath || "—")}</code></p>
                <p><span class="admin-cover-label">Status:</span> ${coverStatusHTML(r)}</p>
              </div>
            </div>
          </div>
          <details class="admin-row__details">
            <summary>Edit description</summary>
            <div class="admin-row__fields">
              <label class="field">
                <span>Description (optional website copy — name/membership stay in Square)</span>
                <textarea data-field="description" rows="3">${escapeHtml(r.description)}</textarea>
              </label>
            </div>
          </details>
        </div>
      </article>`;
    })
    .join("");
}

async function refreshCoverStatuses() {
  await Promise.all(
    rows.map(async (r) => {
      const result = await probeCollectionCover(r.name || r.displayName);
      r.coverFound = result.found;
      r.image = result.url;
      r.coverRepoPath = result.repoPath;
    })
  );
  render();
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

  listEl.addEventListener("error", (e) => {
    const img = e.target.closest("img[data-fallback]");
    if (!img || img.dataset.fellBack) return;
    img.dataset.fellBack = "1";
    img.src = img.dataset.fallback || COLLECTION_COVER_FALLBACK;
  }, true);

  listEl.addEventListener("dragstart", (e) => {
    if (e.target.closest("button, input, a, label, textarea, details, summary, img")) {
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
  setStatus("Loading collections from Square…");
  clearCollectionsMetaCache();
  await probeKv();

  let all;
  let publicList = [];
  try {
    [all, publicList] = await Promise.all([getAllCollectionRecords(), getCollections()]);
  } catch (err) {
    setStatus("Could not load Square catalog collections.", "error");
    listEl.innerHTML = `<p class="empty-state__body">Failed to load collections. Check /api/catalog and reload.</p>`;
    console.error(err);
    return;
  }

  rows = all.map(normalizeRow);
  // Keep admin order stable; reindex only if every sortOrder is 0
  if (rows.every((r) => !r.sortOrder)) reindexOrder();
  else rows.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  dirty = false;
  render();
  refreshCoverStatuses();

  const withProducts = rows.filter((r) => r.productCount > 0).length;
  const publicNames = publicList.map((c) => c.name).sort().join(", ") || "—";
  const parity =
    withProducts === publicList.length
      ? `Public /collections shows the same ${publicList.length} with products (${publicNames}).`
      : `Public /collections has ${publicList.length} with products; admin lists ${rows.length} Square values (${withProducts} with products).`;

  if (localPreview) {
    setStatus(
      `${rows.length} Square collections loaded (local preview — Save needs Wrangler + KV). ${parity}`,
      "warn"
    );
  } else if (kvConfigured === false) {
    setStatus(
      `${rows.length} Square collections loaded. KV (COLLECTIONS_CONFIG) not bound — Save will not persist. ${parity}`,
      "error"
    );
  } else {
    setStatus(`${rows.length} Square collections loaded. ${parity}`, "ok");
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
      setStatus("Saved. Presentation settings stored; membership still comes from Square.", "ok");
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
