// Single collection page — hero, description, and products for one Square category.
// URL: collection.html?handle=<category-handle>
import {
  getCollectionByHandle,
  getProducts,
  queryProducts,
} from "./catalog.js";
import { productCardHTML, wireFavorites, escapeHtml } from "./ui.js";

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
    grid.innerHTML = `<p class="empty">No products in this collection yet.</p>`;
  } else {
    grid.innerHTML = results.map(productCardHTML).join("");
    wireFavorites(grid);
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
    mount.innerHTML = `<div class="page-wrap"><p class="error">No collection selected. <a href="./collections.html">Browse all collections</a>.</p></div>`;
    return;
  }

  try {
    [collection, products] = await Promise.all([
      getCollectionByHandle(handle),
      getProducts(),
    ]);
  } catch (err) {
    mount.innerHTML = `<div class="page-wrap"><p class="error">Could not load this collection right now.</p></div>`;
    console.error(err);
    return;
  }

  if (!collection) {
    mount.innerHTML = `<div class="page-wrap"><p class="empty">We couldn't find that collection. <a href="./collections.html">See what's available</a>.</p></div>`;
    return;
  }

  syncDocumentMeta(collection);
  renderPage(collection);
}

init();
