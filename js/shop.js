// Shop page — search, category filter, sort, and product grid rendered from the catalog.
import { getProducts, getCollections, queryProducts } from "./catalog.js";
import { productCardHTML, wireFavorites } from "./ui.js";

const state = { search: "", category: "all", sort: "featured" };
let allProducts = [];

const grid = document.getElementById("shop-grid");
const countEl = document.getElementById("shop-count");
const searchInput = document.getElementById("shop-search");
const sortSelect = document.getElementById("shop-sort");
const categoryList = document.getElementById("category-list");

function render() {
  const results = queryProducts(allProducts, state);
  if (!results.length) {
    grid.innerHTML = `<p class="empty">No products match your search. Try clearing filters.</p>`;
  } else {
    grid.innerHTML = results.map(productCardHTML).join("");
    wireFavorites(grid);
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
  // Sidebar lists only collections that currently have products (+ All Products).
  const cats = await getCollections();
  const items = [{ handle: "all", name: "All Products" }, ...cats];
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
  try {
    allProducts = await getProducts();
  } catch (err) {
    grid.innerHTML = `<p class="error">Could not load products right now.</p>`;
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
