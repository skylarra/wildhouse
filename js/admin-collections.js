// Admin · Collections — presentation controls over Square-derived collections.
// Names + membership: Square Collection custom attribute (same as /collections).
// Covers: assets/collections/{normalizeCollectionKey}.png
// Persistence: PUT /api/collections-config → Cloudflare KV (COLLECTIONS_CONFIG).
// Auth: existing Bearer ADMIN_PASSWORD session (js/admin-auth.js).
import { getAllCollectionRecords, getCollections, clearCollectionsMetaCache } from "./catalog.js";
import { toSavableConfig } from "./collections-config.js";
import {
  collectionCoverFilename,
  collectionCoverRepoPath,
  collectionCoverSrc,
  COLLECTION_COVER_FALLBACK,
  probeCollectionCover,
} from "./collection-assets.js";
import {
  requireAdmin,
  mountAdminChrome,
  getAdminToken,
  clearAdminSession,
  adminAuthHeader,
  logoutAdmin,
} from "./admin-auth.js";
import { escapeHtml } from "./ui.js";

if (!requireAdmin()) {
  /* redirected to login */
} else {
  mountAdminChrome();
  boot();
}

/** @type {ReturnType<typeof normalizeRow>[]} */
let rows = [];
let dragKey = null;
let kvConfigured = null;
let dirty = false;

const listEl = document.getElementById("admin-list");
const statusEl = document.getElementById("admin-status");

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
    coverFound: null,
    isNew: Boolean(r.isNew),
  };
}

function setStatus(msg, kind = "") {
  if (!statusEl) return;
  statusEl.textContent = msg || "";
  statusEl.className = `admin-status${kind ? ` is-${kind}` : ""}`;
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
  if (!listEl) return;

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
    if (field.dataset.field === "description") {
      row.description = field.value;
      markDirty();
    }
  });

  listEl.addEventListener(
    "error",
    (e) => {
      const img = e.target.closest("img[data-fallback]");
      if (!img || img.dataset.fellBack) return;
      img.dataset.fellBack = "1";
      img.src = img.dataset.fallback || COLLECTION_COVER_FALLBACK;
    },
    true
  );

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
    e.target.closest(".admin-row")?.classList.remove("is-dragging");
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
    if (listEl) {
      listEl.innerHTML = `<p class="empty-state__body">Failed to load collections. Check /api/catalog and reload.</p>`;
    }
    console.error(err);
    return;
  }

  rows = all.map(normalizeRow);
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

  if (kvConfigured === false) {
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
  const token = getAdminToken();

  if (!token) {
    setStatus("Session expired. Please log in again.", "error");
    logoutAdmin({ redirect: true });
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
        ...adminAuthHeader(),
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
      clearAdminSession();
      setStatus("Unauthorized — please log in again.", "error");
      logoutAdmin({ redirect: true });
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

function boot() {
  wireList();
  document.getElementById("admin-save")?.addEventListener("click", () => save());
  document.getElementById("admin-export")?.addEventListener("click", () => downloadConfig());
  document.getElementById("admin-reload")?.addEventListener("click", () => loadRows());
  loadRows();
}
