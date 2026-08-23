// Single collection page — hero, description, and products for one Square category.
// URL: collection.html?handle=<category-handle>
import {
  getCollectionByHandle,
  getProducts,
  queryProducts,
} from "./catalog.js";
import { productCardHTML, wireFavorites, wireImagePlaceholders, escapeHtml } from "./ui.js";

const mount = document.getElementById("collection-page");
const state = { sort: "featured" };
let collection = null;
let products = [];

function handleFromUrl() {
  return new URLSearchParams(location.search).get("handle") || "";
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
    canonical.href = `https://wildhouselane.com/collection.html?handle=${encodeURIComponent(col.handle)}`;
  }
}

function renderProducts() {
  const grid = document.getElementById("collection-grid");
  const countEl = document.getElementById("collection-count");
  if (!grid) return;
  const results = queryProducts(products, {
    category: collection.handle,
    sort: state.sort,
  });
  if (!results.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h2 class="empty-state__title">This collection is empty</h2>
        <p class="empty-state__body">Nothing is listed here yet. Explore other collections or the full shop.</p>
        <div class="empty-state__actions">
          <a class="btn secondary" href="./collections.html">All collections</a>
          <a class="btn" href="./shop.html">Shop all</a>
        </div>
      </div>`;
  } else {
    grid.innerHTML = results.map(productCardHTML).join("");
    wireFavorites(grid);
    wireImagePlaceholders(grid);
  }
  if (countEl) {
    countEl.textContent = `${results.length} ${results.length === 1 ? "piece" : "pieces"}`;
  }
}

function renderPage(col) {
  const heroSrc = col.heroImage || col.image;
  mount.innerHTML = `
    <section class="collection-hero" aria-label="${escapeHtml(col.name)} collection">
      <img class="collection-hero__image" src="${heroSrc}" alt="" role="presentation">
    </section>
    <div class="collection-intro page-wrap">
      <nav class="collection-breadcrumb" aria-label="Breadcrumb">
        <a href="./collections.html">Collections</a>
        <span aria-hidden="true"> / </span>
        <span>${escapeHtml(col.name)}</span>
      </nav>
      <h1 class="page-title">${escapeHtml(col.name)}</h1>
      ${
        col.description
          ? `<p class="collection-intro__body">${escapeHtml(col.description)}</p>`
          : ""
      }
      <div class="collection-toolbar">
        <label class="field">
          <span class="visually-hidden">Sort products</span>
          <select id="collection-sort">
            <option value="featured">Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="name-asc">Name: A to Z</option>
          </select>
        </label>
        <p class="shop-count" id="collection-count" aria-live="polite"></p>
        <a class="btn secondary" href="./shop.html?category=${encodeURIComponent(col.handle)}">Filter in Shop</a>
      </div>
    </div>
    <div class="page-wrap">
      <div class="product-grid collection-product-grid" id="collection-grid"></div>
    </div>`;

  const sortSelect = document.getElementById("collection-sort");
  if (sortSelect) {
    sortSelect.value = state.sort;
    sortSelect.addEventListener("change", () => {
      state.sort = sortSelect.value;
      renderProducts();
    });
  }
  renderProducts();
}

async function init() {
  if (!mount) return;
  const handle = handleFromUrl();
  if (!handle) {
    mount.innerHTML = `<div class="page-wrap">
      <div class="empty-state">
        <h2 class="empty-state__title">No collection selected</h2>
        <p class="empty-state__body">Pick a collection to browse handmade pieces by theme.</p>
        <div class="empty-state__actions">
          <a class="btn secondary" href="./collections.html">Browse collections</a>
        </div>
      </div>
    </div>`;
    return;
  }

  mount.innerHTML = `<div class="page-wrap"><div class="skeleton-grid" aria-hidden="true">${Array.from({ length: 8 }, () => `
    <div class="skeleton-card"><div class="skeleton-card__media"></div><div class="skeleton-card__line"></div><div class="skeleton-card__line skeleton-card__line--short"></div></div>`).join("")}</div></div>`;

  try {
    [collection, products] = await Promise.all([
      getCollectionByHandle(handle),
      getProducts(),
    ]);
  } catch (err) {
    mount.innerHTML = `<div class="page-wrap">
      <div class="empty-state">
        <h2 class="empty-state__title">Couldn’t load this collection</h2>
        <p class="empty-state__body">Please try again in a moment.</p>
        <div class="empty-state__actions">
          <a class="btn secondary" href="./collections.html">All collections</a>
          <a class="btn" href="./shop.html">Shop all</a>
        </div>
      </div>
    </div>`;
    console.error(err);
    return;
  }

  if (!collection) {
    mount.innerHTML = `<div class="page-wrap">
      <div class="empty-state">
        <h2 class="empty-state__title">Collection not found</h2>
        <p class="empty-state__body">That collection may have moved. See what’s available now.</p>
        <div class="empty-state__actions">
          <a class="btn secondary" href="./collections.html">See collections</a>
          <a class="btn" href="./shop.html">Shop all</a>
        </div>
      </div>
    </div>`;
    return;
  }

  syncDocumentMeta(collection);
  renderPage(collection);
}

init();
