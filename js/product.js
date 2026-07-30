// Product detail page — gallery, variant selection, add-to-cart, related products.
import { getProductByHandle, getRelated, formatMoney } from "./catalog.js";
import { addToCart, pushRecentlyViewed, isFavorite, toggleFavorite } from "./store.js";
import { productCardHTML, wireFavorites, toast, escapeHtml } from "./ui.js";

const root = document.getElementById("product-root");
const params = new URLSearchParams(location.search);
const handle = params.get("handle");

let product = null;
let selectedVariation = null;

function currentStock() {
  return selectedVariation ? selectedVariation.stock : 0;
}

function renderGallery() {
  const imgs = product.images.length ? product.images : ["./assets/Wildhouse.png"];
  const thumbs = imgs
    .map(
      (src, i) =>
        `<button class="gallery__thumb${i === 0 ? " is-active" : ""}" data-src="${src}" type="button" aria-label="View image ${i + 1}"><img src="${src}" alt="" loading="lazy"></button>`
    )
    .join("");
  return `
    <div class="gallery">
      <div class="gallery__main"><img id="gallery-main" src="${imgs[0]}" alt="${escapeHtml(product.name)}"></div>
      ${imgs.length > 1 ? `<div class="gallery__thumbs">${thumbs}</div>` : ""}
    </div>`;
}

function renderVariations() {
  if (!product.hasVariants) return "";
  const opts = product.variations
    .map(
      (v) =>
        `<option value="${v.id}"${v.stock === 0 ? " disabled" : ""}>${escapeHtml(v.name)}${v.stock === 0 ? " — sold out" : ""}</option>`
    )
    .join("");
  return `
    <label class="field">
      <span>Option</span>
      <select id="variation-select">${opts}</select>
    </label>`;
}

function renderPriceAndStock() {
  const priceEl = document.getElementById("product-price");
  const stockEl = document.getElementById("product-stock");
  const addBtn = document.getElementById("add-to-cart");
  if (priceEl) priceEl.textContent = formatMoney(selectedVariation.priceCents);
  const stock = currentStock();
  if (stockEl) {
    if (stock === 0) {
      stockEl.textContent = "Sold out";
      stockEl.className = "product-stock is-out";
    } else if (stock <= 5) {
      stockEl.textContent = `Only ${stock} left`;
      stockEl.className = "product-stock is-low";
    } else {
      stockEl.textContent = "In stock";
      stockEl.className = "product-stock";
    }
  }
  if (addBtn) {
    addBtn.disabled = stock === 0;
    addBtn.textContent = stock === 0 ? "Sold out" : "Add to cart";
  }
}

function pickDefaultVariation() {
  return product.variations.find((v) => v.stock > 0) || product.variations[0];
}

function render() {
  selectedVariation = pickDefaultVariation();
  const fav = isFavorite(product.id);
  root.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="./shop.html">Shop</a> /
      ${
        product.categoryHandle
          ? `<a href="./collection.html?handle=${encodeURIComponent(product.categoryHandle)}">${escapeHtml(product.categoryName)}</a> /`
          : ""
      }
      <span>${escapeHtml(product.name)}</span>
    </nav>
    <div class="product-detail">
      ${renderGallery()}
      <div class="product-info">
        <p class="product-category">${
          product.categoryHandle
            ? `<a href="./collection.html?handle=${encodeURIComponent(product.categoryHandle)}">${escapeHtml(product.categoryName)}</a>`
            : escapeHtml(product.categoryName)
        }</p>
        <h1>${escapeHtml(product.name)}</h1>
        <p class="product-price" id="product-price"></p>
        <p class="product-stock" id="product-stock"></p>
        <p class="product-description">${escapeHtml(product.description)}</p>
        ${renderVariations()}
        <div class="product-actions">
          <label class="field qty-field">
            <span>Qty</span>
            <input type="number" id="qty" min="1" value="1" inputmode="numeric">
          </label>
          <button class="btn secondary" id="add-to-cart" type="button">Add to cart</button>
          <button class="fav-btn fav-btn--lg${fav ? " is-active" : ""}" id="fav-btn" type="button" aria-pressed="${fav}" aria-label="${fav ? "Remove from" : "Add to"} favorites">&#9829;</button>
        </div>
      </div>
    </div>
    <section class="related">
      <h2>You may also like</h2>
      <div class="product-grid" id="related-grid"></div>
    </section>`;

  renderPriceAndStock();
  wireGallery();
  wireControls();
  renderRelated();
}

function wireGallery() {
  const main = document.getElementById("gallery-main");
  root.querySelectorAll(".gallery__thumb").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      main.src = thumb.dataset.src;
      root.querySelectorAll(".gallery__thumb").forEach((t) => t.classList.remove("is-active"));
      thumb.classList.add("is-active");
    });
  });
}

function wireControls() {
  const select = document.getElementById("variation-select");
  if (select) {
    select.addEventListener("change", () => {
      selectedVariation = product.variations.find((v) => v.id === select.value);
      renderPriceAndStock();
    });
  }

  const addBtn = document.getElementById("add-to-cart");
  const qtyInput = document.getElementById("qty");
  addBtn.addEventListener("click", () => {
    const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    addToCart(
      {
        variationId: selectedVariation.id,
        itemId: product.id,
        name: product.name,
        variationName: product.hasVariants ? selectedVariation.name : "",
        priceCents: selectedVariation.priceCents,
        image: product.images[0] || "./assets/Wildhouse.png",
        handle: product.handle,
      },
      qty
    );
    toast(`Added ${product.name} to cart`);
  });

  const favBtn = document.getElementById("fav-btn");
  favBtn.addEventListener("click", () => {
    const favs = toggleFavorite(product.id);
    const active = favs.includes(product.id);
    favBtn.classList.toggle("is-active", active);
    favBtn.setAttribute("aria-pressed", String(active));
    favBtn.setAttribute("aria-label", `${active ? "Remove from" : "Add to"} favorites`);
  });
}

async function renderRelated() {
  const grid = document.getElementById("related-grid");
  const related = await getRelated(product, 4);
  if (!related.length) {
    grid.closest(".related").hidden = true;
    return;
  }
  grid.innerHTML = related.map(productCardHTML).join("");
  wireFavorites(grid);
}

async function init() {
  if (!handle) {
    root.innerHTML = `<p class="error">No product specified. <a href="./shop.html">Back to shop</a>.</p>`;
    return;
  }
  try {
    product = await getProductByHandle(handle);
  } catch (err) {
    root.innerHTML = `<p class="error">Could not load this product.</p>`;
    console.error(err);
    return;
  }
  if (!product) {
    root.innerHTML = `<p class="error">Sorry, we couldn't find that product. <a href="./shop.html">Back to shop</a>.</p>`;
    return;
  }
  document.title = `${product.name} | Wildhouse Lane`;
  syncProductMeta(product);
  pushRecentlyViewed(product.id);
  render();
}

function upsertMeta(selector, attr, value) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    const prop = selector.match(/property="([^"]+)"/);
    const name = selector.match(/name="([^"]+)"/);
    if (prop) el.setAttribute("property", prop[1]);
    if (name) el.setAttribute("name", name[1]);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function syncProductMeta(product) {
  const origin = "https://wildhouselane.com";
  const url = `${origin}/product.html?handle=${encodeURIComponent(product.handle)}`;
  const image = product.images[0]
    ? product.images[0].startsWith("http")
      ? product.images[0]
      : `${origin}/${product.images[0].replace(/^\.\//, "")}`
    : `${origin}/assets/wildhouselogo-pink-brown.png`;
  const description = (product.description || `${product.name} from Wildhouse Lane.`).slice(0, 160);

  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", description);

  upsertMeta('meta[property="og:title"]', "content", `${product.name} | Wildhouse Lane`);
  upsertMeta('meta[property="og:description"]', "content", description);
  upsertMeta('meta[property="og:image"]', "content", image);
  upsertMeta('meta[property="og:url"]', "content", url);
  upsertMeta('meta[property="og:type"]', "content", "product");

  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = url;

  let ld = document.getElementById("product-jsonld");
  if (!ld) {
    ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = "product-jsonld";
    document.head.appendChild(ld);
  }
  const offer = product.variations[0];
  ld.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images,
    sku: offer?.sku,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: offer?.currency || "USD",
      price: ((offer?.priceCents || 0) / 100).toFixed(2),
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  });
}

init();
