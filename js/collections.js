// Collections page — one card per category, linking into the filtered shop.
import { getProducts, getCategories } from "./catalog.js";
import { escapeHtml } from "./ui.js";

async function init() {
  const grid = document.getElementById("collections-grid");
  if (!grid) return;
  try {
    const [cats, products] = await Promise.all([getCategories(), getProducts()]);
    grid.innerHTML = cats
      .map((c) => {
        const inCat = products.filter((p) => p.categoryId === c.id);
        const cover = inCat.find((p) => p.images.length)?.images[0] || "./assets/Wildhouse.png";
        return `
          <a class="collection-card" href="./shop.html?category=${c.handle}">
            <div class="collection-card__media"><img src="${cover}" alt="${escapeHtml(c.name)}" loading="lazy"></div>
            <h3>${escapeHtml(c.name)}</h3>
            <p>${inCat.length} ${inCat.length === 1 ? "product" : "products"}</p>
          </a>`;
      })
      .join("");
  } catch (err) {
    grid.innerHTML = `<p class="error">Could not load collections right now.</p>`;
    console.error(err);
  }
}

init();
