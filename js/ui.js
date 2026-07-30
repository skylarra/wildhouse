// Wildhouse Lane — shared UI helpers reused across pages (product cards,
// favorite toggles, and a lightweight toast) so markup is not duplicated.

import { formatMoney } from "./catalog.js";
import { isFavorite, toggleFavorite } from "./store.js";

const FALLBACK_IMG = "./assets/Wildhouse.png";

export function productCardHTML(product) {
  const img = product.images[0] || FALLBACK_IMG;
  const priceLabel =
    product.hasVariants && product.minPriceCents !== product.maxPriceCents
      ? `From ${formatMoney(product.minPriceCents)}`
      : formatMoney(product.minPriceCents);
  const fav = isFavorite(product.id);
  const soldOut = product.inStock ? "" : '<span class="badge badge--soldout">Sold out</span>';

  return `
    <article class="product-card" data-item-id="${product.id}">
      <a class="product-card__link" href="./product.html?handle=${encodeURIComponent(product.handle)}">
        <div class="product-card__media">
          <img src="${img}" alt="${escapeHtml(product.name)}" loading="lazy">
          ${soldOut}
        </div>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="product-card__price">${priceLabel}</p>
      </a>
      <button class="fav-btn${fav ? " is-active" : ""}" type="button"
        data-item-id="${product.id}" aria-pressed="${fav}"
        aria-label="${fav ? "Remove from" : "Add to"} favorites">&#9829;</button>
    </article>`;
}

// Delegate favorite clicks for any container that holds product cards.
export function wireFavorites(container) {
  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".fav-btn");
    if (!btn) return;
    e.preventDefault();
    const id = btn.dataset.itemId;
    const favs = toggleFavorite(id);
    const active = favs.includes(id);
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
    btn.setAttribute("aria-label", `${active ? "Remove from" : "Add to"} favorites`);
  });
}

let toastTimer = null;
export function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2600);
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

export function collectionCardHTML(collection) {
  const blurb = collection.description
    ? `<p class="collection-card__blurb">${escapeHtml(collection.description)}</p>`
    : `<p>${collection.count} ${collection.count === 1 ? "product" : "products"}</p>`;
  return `
    <a class="collection-card" href="./collection.html?handle=${encodeURIComponent(collection.handle)}">
      <div class="collection-card__media">
        <img src="${collection.image}" alt="${escapeHtml(collection.name)}" loading="lazy">
      </div>
      <h3>${escapeHtml(collection.name)}</h3>
      ${blurb}
    </a>`;
}
