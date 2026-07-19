// Home page — renders featured "best sellers" and any recently-viewed products.
import { getFeatured, getProducts } from "./catalog.js";
import { getRecentlyViewed } from "./store.js";
import { productCardHTML, wireFavorites } from "./ui.js";

async function renderFeatured() {
  const grid = document.getElementById("featured-grid");
  if (!grid) return;
  try {
    const featured = await getFeatured(4);
    grid.innerHTML = featured.map(productCardHTML).join("");
    wireFavorites(grid);
  } catch (err) {
    grid.innerHTML = `<p class="error">Could not load products right now.</p>`;
    console.error(err);
  }
}

async function renderRecentlyViewed() {
  const section = document.getElementById("recently-viewed");
  const grid = document.getElementById("recently-viewed-grid");
  if (!section || !grid) return;
  const ids = getRecentlyViewed();
  if (!ids.length) return;
  const products = await getProducts();
  const items = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean);
  if (!items.length) return;
  grid.innerHTML = items.map(productCardHTML).join("");
  wireFavorites(grid);
  section.hidden = false;
}

renderFeatured();
renderRecentlyViewed();
