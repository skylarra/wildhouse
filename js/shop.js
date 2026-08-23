// Shop page — search, product-type filter (Square Category), sort, and product grid.
import { getProducts, getProductTypes, queryProducts } from "./catalog.js";
import { productCardHTML, wireFavorites, wireImagePlaceholders } from "./ui.js";

const state = { search: "", category: "all", sort: "featured" };
let allProducts = [];

const grid = document.getElementById("shop-grid");
const countEl = document.getElementById("shop-count");
const searchInput = document.getElementById("shop-search");
const sortSelect = document.getElementById("shop-sort");
const categoryList = document.getElementById("category-list");

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

function render() {
  const results = queryProducts(allProducts, state);
  if (!results.length) {
    grid.innerHTML = emptyStateHTML({
      title: "No products match",
      body: "Try a different search, clear filters, or browse everything in the shop.",
      primary: { href: "./shop.html", label: "Clear filters" },
      secondary: { href: "./collections.html", label: "Browse collections" },
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

async function renderCategories() {
  if (!categoryList) return;
  // Sidebar lists Square product types (categories), not thematic Collections.
  const types = await getProductTypes();
  const items = [{ handle: "all", name: "All Products" }, ...types];
  categoryList.innerHTML = items
    .map(
      (c) =>
        `<li><a href="${c.handle === "all" ? "./shop.html" : `./shop.html?category=${encodeURIComponent(c.handle)}`}" data-category="${c.handle}"${c.handle === state.category ? ' class="is-active"' : ""}>${c.name}</a></li>`
    )
    .join("");
  categoryList.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link) return;
    e.preventDefault();
    state.category = link.dataset.category;
    syncUrl();
    render();
  });
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.category !== "all") params.set("category", state.category);
  if (state.search) params.set("q", state.search);
  if (state.sort !== "featured") params.set("sort", state.sort);
  const qs = params.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

function initFromUrl() {
  const params = new URLSearchParams(location.search);
  state.category = params.get("category") || "all";
  state.search = params.get("q") || "";
  state.sort = params.get("sort") || "featured";
  if (searchInput) searchInput.value = state.search;
  if (sortSelect) sortSelect.value = state.sort;
}

async function init() {
  if (grid) grid.innerHTML = skeletonGridHTML(8);
  try {
    allProducts = await getProducts();
  } catch (err) {
    grid.innerHTML = emptyStateHTML({
      title: "Shop is taking a rest",
      body: "We couldn’t load products right now. Please try again in a moment.",
      primary: { href: "./index.html", label: "Back to home" },
      secondary: { href: "./contact.html", label: "Contact us" },
    });
    console.error(err);
    return;
  }
  initFromUrl();
  await renderCategories();

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.search = searchInput.value;
      syncUrl();
      render();
    });
  }
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      state.sort = sortSelect.value;
      syncUrl();
      render();
    });
  }
  render();
}

init();
