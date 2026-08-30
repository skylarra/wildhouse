// Collection page — same layout as Shop All, scoped to one Square Collection.
// URLs:
//   /collections/<slug>          (Cloudflare _redirects → /collection?handle=…)
//   /collection?handle=<slug>
//   collection.html?handle=<slug>
import {
  getCollectionByHandle,
  getProducts,
  queryProducts,
  productInCollection,
} from "./catalog.js";
import { productCardHTML, wireFavorites, wireImagePlaceholders, escapeHtml } from "./ui.js";

const state = { search: "", category: "all", sort: "featured" };
let collection = null;
/** Products that belong to the active collection (already filtered). */
let collectionProducts = [];

const grid = document.getElementById("shop-grid");
const countEl = document.getElementById("shop-count");
const searchInput = document.getElementById("shop-search");
const sortSelect = document.getElementById("shop-sort");
const categoryList = document.getElementById("category-list");
const headingEl = document.getElementById("collection-heading");

function handleFromUrl() {
  const q = new URLSearchParams(location.search).get("handle");
  if (q) return q;
  const m = location.pathname.match(/\/collections\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : "";
}

function emptyStateHTML({ title, body, primary, secondary }) {
  const second = secondary
    ? `<a class="btn" href="${secondary.href}">${secondary.label}</a>`
    : "";
  return `
    <div class="empty-state">
      <h2 class="empty-state__title">${title}</h2>
      <p class="empty-state__body">${body}</p>
      <div class="empty-state__actions">
        <a class="btn secondary" href="${primary.href}">${primary.label}</a>
        ${second}
      </div>
    </div>`;
}

function skeletonGridHTML(count = 8) {
  return `<div class="skeleton-grid" aria-hidden="true">${Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton-card__media"></div>
      <div class="skeleton-card__line"></div>
      <div class="skeleton-card__line skeleton-card__line--short"></div>
    </div>`).join("")}</div>`;
}

function syncDocumentMeta(col) {
  document.title = `${col.name} | Wildhouse Lane`;
  const desc = col.description
    ? col.description.slice(0, 155)
    : `Shop the ${col.name} collection at Wildhouse Lane.`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", desc);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", `${col.name} | Wildhouse Lane`);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute("content", desc);
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    canonical.href = `https://wildhouselane.com/collections/${encodeURIComponent(col.handle)}`;
  }
}

function syncUrl() {
  const params = new URLSearchParams();
  if (!/\/collections\/[^/]+\/?$/.test(location.pathname) && collection?.handle) {
    params.set("handle", collection.handle);
  }
  if (state.category !== "all") params.set("category", state.category);
  if (state.search) params.set("q", state.search);
  if (state.sort !== "featured") params.set("sort", state.sort);
  const qs = params.toString();
  history.replaceState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);
}

function initFromUrl() {
  const params = new URLSearchParams(location.search);
  state.category = params.get("category") || params.get("type") || "all";
  state.search = params.get("q") || "";
  state.sort = params.get("sort") || "featured";
  if (searchInput) searchInput.value = state.search;
  if (sortSelect) sortSelect.value = state.sort;
}

function typesInCollection(list) {
  const map = new Map();
  for (const p of list) {
    if (!p.categoryHandle) continue;
    if (!map.has(p.categoryHandle)) {
      map.set(p.categoryHandle, { handle: p.categoryHandle, name: p.categoryName });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function renderCategories() {
  if (!categoryList) return;
  // Sidebar lists product types present in this collection (same UI as Shop All).
  const types = typesInCollection(collectionProducts);
  const items = [{ handle: "all", name: "All Products" }, ...types];
  categoryList.innerHTML = items
    .map(
      (c) =>
        `<li><a href="#" data-category="${escapeHtml(c.handle)}"${
          c.handle === state.category ? ' class="is-active"' : ""
        }>${escapeHtml(c.name)}</a></li>`
    )
    .join("");
}

function render() {
  if (!grid) return;
  const results = queryProducts(collectionProducts, {
    search: state.search,
    category: state.category,
    sort: state.sort,
  });
  if (!results.length) {
    grid.innerHTML = emptyStateHTML({
      title: "No products match",
      body: "Try a different search, clear filters, or browse another collection.",
      primary: { href: "./collections.html", label: "All collections" },
      secondary: { href: "./shop.html", label: "Shop all" },
    });
  } else {
    grid.innerHTML = results.map(productCardHTML).join("");
    wireFavorites(grid);
    wireImagePlaceholders(grid);
  }
  if (countEl) {
    countEl.textContent = `${results.length} ${results.length === 1 ? "product" : "products"}`;
  }
  if (categoryList) {
    categoryList.querySelectorAll("a").forEach((a) => {
      a.classList.toggle("is-active", a.dataset.category === state.category);
    });
  }
}

function wireChrome() {
  categoryList?.addEventListener("click", (e) => {
    const link = e.target.closest("a[data-category]");
    if (!link) return;
    e.preventDefault();
    state.category = link.dataset.category;
    syncUrl();
    render();
  });
  searchInput?.addEventListener("input", () => {
    state.search = searchInput.value;
    syncUrl();
    render();
  });
  sortSelect?.addEventListener("change", () => {
    state.sort = sortSelect.value;
    syncUrl();
    render();
  });
}

async function init() {
  const handle = handleFromUrl();
  if (grid) grid.innerHTML = skeletonGridHTML(8);

  if (!handle) {
    if (headingEl) headingEl.textContent = "COLLECTION";
    if (grid) {
      grid.innerHTML = emptyStateHTML({
        title: "No collection selected",
        body: "Pick a collection to browse handmade pieces by theme.",
        primary: { href: "./collections.html", label: "Browse collections" },
        secondary: { href: "./shop.html", label: "Shop all" },
      });
    }
    return;
  }

  let allProducts = [];
  try {
    [collection, allProducts] = await Promise.all([
      getCollectionByHandle(handle),
      getProducts(),
    ]);
  } catch (err) {
    if (grid) {
      grid.innerHTML = emptyStateHTML({
        title: "Collection is taking a rest",
        body: "We couldn’t load this collection right now. Please try again in a moment.",
        primary: { href: "./collections.html", label: "All collections" },
        secondary: { href: "./contact.html", label: "Contact us" },
      });
    }
    console.error(err);
    return;
  }

  if (!collection) {
    if (headingEl) headingEl.textContent = "COLLECTION";
    if (grid) {
      grid.innerHTML = emptyStateHTML({
        title: "Collection not found",
        body: "That collection may have moved. See what’s available now.",
        primary: { href: "./collections.html", label: "See collections" },
        secondary: { href: "./shop.html", label: "Shop all" },
      });
    }
    return;
  }

  syncDocumentMeta(collection);
  if (headingEl) headingEl.textContent = collection.name.toUpperCase();

  collectionProducts = allProducts.filter((p) => productInCollection(p, collection.handle));
  initFromUrl();
  renderCategories();
  wireChrome();
  render();
}

init();
