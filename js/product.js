// Product detail page — 4:5 gallery with zoom, variants, cart, info notes, related.
import { getProductByHandle, getRelated, formatMoney } from "./catalog.js";
import { loadJSON, loadSite } from "./content.js";
import { addToCart, pushRecentlyViewed, isFavorite, toggleFavorite } from "./store.js";
import { productCardHTML, wireFavorites, toast, escapeHtml } from "./ui.js";

const root = document.getElementById("product-root");
const params = new URLSearchParams(location.search);
const handle = params.get("handle");

let product = null;
let selectedVariation = null;
let info = null;
let freeShippingThresholdCents = 7500;
let galleryIndex = 0;
let galleryImages = [];

const DEFAULT_INFO = {
  processingTime: {
    label: "Estimated processing",
    text: "Handmade to order — typically ships in 3–5 business days.",
  },
  handmade: {
    label: "Handmade",
    text: "Designed and finished by hand in South Carolina.",
  },
  shipping: {
    label: "Shipping",
    text: "Carefully packed and shipped from the studio.",
    policiesHref: "./policies.html",
    policiesLabel: "Shipping & policies",
  },
  inventory: {
    inStock: "In stock — ready to make",
    lowStock: "Only {count} left",
    outOfStock: "Sold out",
    outOfStockNote: "This piece is resting for now. Check back soon, or browse related finds below.",
  },
  gallery: {
    zoomHint: "Click to zoom",
    zoomCloseLabel: "Close",
    zoomPrevLabel: "Previous image",
    zoomNextLabel: "Next image",
  },
  relatedHeading: "You may also like",
};

function currentStock() {
  return selectedVariation ? selectedVariation.stock : 0;
}

function stockCopy(stock) {
  const inv = info.inventory || DEFAULT_INFO.inventory;
  if (stock === 0) return { text: inv.outOfStock, className: "product-stock is-out" };
  if (stock <= 5) {
    return {
      text: String(inv.lowStock || DEFAULT_INFO.inventory.lowStock).replace("{count}", String(stock)),
      className: "product-stock is-low",
    };
  }
  return { text: inv.inStock || DEFAULT_INFO.inventory.inStock, className: "product-stock" };
}

function shippingText() {
  const shipping = info.shipping || DEFAULT_INFO.shipping;
  let text = shipping.text || "";
  const threshold = formatMoney(freeShippingThresholdCents);
  // Keep JSON editable while still reflecting site.json threshold when present.
  text = text.replace(/\$\d+(?:\.\d+)?/, threshold);
  return text;
}

function renderGallery() {
  galleryImages = product.images.length ? product.images : ["./assets/Wildhouse.png"];
  galleryIndex = 0;
  const hint = info.gallery?.zoomHint || DEFAULT_INFO.gallery.zoomHint;
  const thumbs = galleryImages
    .map(
      (src, i) =>
        `<button class="gallery__thumb${i === 0 ? " is-active" : ""}" data-index="${i}" type="button" aria-label="View image ${i + 1}" aria-current="${i === 0 ? "true" : "false"}"><img src="${src}" alt="" loading="lazy"></button>`
    )
    .join("");

  return `
    <div class="gallery">
      <button type="button" class="gallery__main" id="gallery-zoom-btn" aria-label="${escapeHtml(hint)}: ${escapeHtml(product.name)}">
        <span class="gallery__frame">
          <img id="gallery-main" src="${galleryImages[0]}" alt="${escapeHtml(product.name)}">
        </span>
        <span class="gallery__zoom-hint">${escapeHtml(hint)}</span>
      </button>
      ${galleryImages.length > 1 ? `<div class="gallery__thumbs" role="list">${thumbs}</div>` : ""}
    </div>
    <dialog class="zoom-dialog" id="zoom-dialog" aria-label="Zoomed product image">
      <div class="zoom-dialog__toolbar">
        <button type="button" class="zoom-dialog__close" id="zoom-close">${escapeHtml(info.gallery?.zoomCloseLabel || "Close")}</button>
      </div>
      <div class="zoom-dialog__stage">
        ${
          galleryImages.length > 1
            ? `<button type="button" class="zoom-dialog__nav zoom-dialog__nav--prev" id="zoom-prev" aria-label="${escapeHtml(info.gallery?.zoomPrevLabel || "Previous image")}">‹</button>`
            : ""
        }
        <img id="zoom-image" src="${galleryImages[0]}" alt="${escapeHtml(product.name)}">
        ${
          galleryImages.length > 1
            ? `<button type="button" class="zoom-dialog__nav zoom-dialog__nav--next" id="zoom-next" aria-label="${escapeHtml(info.gallery?.zoomNextLabel || "Next image")}">›</button>`
            : ""
        }
      </div>
      ${
        galleryImages.length > 1
          ? `<p class="zoom-dialog__count" id="zoom-count" aria-live="polite">1 / ${galleryImages.length}</p>`
          : ""
      }
    </dialog>`;
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

function renderInfoNotes() {
  const processing = info.processingTime || DEFAULT_INFO.processingTime;
  const handmade = info.handmade || DEFAULT_INFO.handmade;
  const shipping = info.shipping || DEFAULT_INFO.shipping;
  const stock = currentStock();
  const outNote =
    stock === 0
      ? `<p class="product-info-note product-info-note--out">${escapeHtml(info.inventory?.outOfStockNote || DEFAULT_INFO.inventory.outOfStockNote)}</p>`
      : "";

  return `
    <aside class="product-notes" aria-label="Product details">
      <div class="product-note">
        <h2>${escapeHtml(processing.label)}</h2>
        <p>${escapeHtml(processing.text)}</p>
      </div>
      <div class="product-note">
        <h2>${escapeHtml(handmade.label)}</h2>
        <p>${escapeHtml(handmade.text)}</p>
      </div>
      <div class="product-note">
        <h2>${escapeHtml(shipping.label)}</h2>
        <p>${escapeHtml(shippingText())}</p>
        ${
          shipping.policiesHref
            ? `<p><a href="${shipping.policiesHref}">${escapeHtml(shipping.policiesLabel || "Shipping & policies")}</a></p>`
            : ""
        }
      </div>
      ${outNote}
    </aside>`;
}

function renderPriceAndStock() {
  const priceEl = document.getElementById("product-price");
  const stockEl = document.getElementById("product-stock");
  const addBtn = document.getElementById("add-to-cart");
  const qtyInput = document.getElementById("qty");
  if (priceEl) priceEl.textContent = formatMoney(selectedVariation.priceCents);
  const stock = currentStock();
  const status = stockCopy(stock);
  if (stockEl) {
    stockEl.textContent = status.text;
    stockEl.className = status.className;
  }
  if (addBtn) {
    addBtn.disabled = stock === 0;
    addBtn.textContent = stock === 0 ? "Sold out" : "Add to cart";
  }
  if (qtyInput) {
    qtyInput.max = String(Math.max(1, stock || 1));
    if (stock > 0 && parseInt(qtyInput.value, 10) > stock) {
      qtyInput.value = String(stock);
    }
  }
}

function pickDefaultVariation() {
  return product.variations.find((v) => v.stock > 0) || product.variations[0];
}

function setGalleryImage(index) {
  if (!galleryImages.length) return;
  galleryIndex = ((index % galleryImages.length) + galleryImages.length) % galleryImages.length;
  const src = galleryImages[galleryIndex];
  const main = document.getElementById("gallery-main");
  const zoomImg = document.getElementById("zoom-image");
  const count = document.getElementById("zoom-count");
  if (main) {
    main.src = src;
    main.alt = product.name;
  }
  if (zoomImg) {
    zoomImg.src = src;
    zoomImg.alt = product.name;
  }
  if (count) count.textContent = `${galleryIndex + 1} / ${galleryImages.length}`;
  root.querySelectorAll(".gallery__thumb").forEach((thumb) => {
    const active = Number(thumb.dataset.index) === galleryIndex;
    thumb.classList.toggle("is-active", active);
    thumb.setAttribute("aria-current", active ? "true" : "false");
  });
}

function render() {
  selectedVariation = pickDefaultVariation();
  const fav = isFavorite(product.id);
  const relatedHeading = info.relatedHeading || DEFAULT_INFO.relatedHeading;
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
        <p class="product-stock" id="product-stock" aria-live="polite"></p>
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
        ${renderInfoNotes()}
      </div>
    </div>
    <section class="related">
      <h2>${escapeHtml(relatedHeading)}</h2>
      <div class="product-grid" id="related-grid"></div>
    </section>`;

  renderPriceAndStock();
  wireGallery();
  wireControls();
  renderRelated();
}

function wireGallery() {
  const dialog = document.getElementById("zoom-dialog");
  const openBtn = document.getElementById("gallery-zoom-btn");
  const closeBtn = document.getElementById("zoom-close");
  const prevBtn = document.getElementById("zoom-prev");
  const nextBtn = document.getElementById("zoom-next");

  root.querySelectorAll(".gallery__thumb").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      setGalleryImage(Number(thumb.dataset.index));
    });
  });

  function openZoom() {
    if (!dialog) return;
    setGalleryImage(galleryIndex);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    closeBtn?.focus();
  }

  function closeZoom() {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    openBtn?.focus();
  }

  openBtn?.addEventListener("click", openZoom);
  closeBtn?.addEventListener("click", closeZoom);
  prevBtn?.addEventListener("click", () => setGalleryImage(galleryIndex - 1));
  nextBtn?.addEventListener("click", () => setGalleryImage(galleryIndex + 1));

  dialog?.addEventListener("click", (e) => {
    // Click the backdrop (the dialog itself) to close.
    if (e.target === dialog) closeZoom();
  });

  dialog?.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setGalleryImage(galleryIndex - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setGalleryImage(galleryIndex + 1);
    }
  });
}

function wireControls() {
  const select = document.getElementById("variation-select");
  if (select) {
    select.addEventListener("change", () => {
      selectedVariation = product.variations.find((v) => v.id === select.value);
      // Re-render notes so out-of-stock message stays in sync with variation.
      const notes = root.querySelector(".product-notes");
      if (notes) notes.outerHTML = renderInfoNotes();
      renderPriceAndStock();
    });
  }

  const addBtn = document.getElementById("add-to-cart");
  const qtyInput = document.getElementById("qty");
  addBtn.addEventListener("click", () => {
    const stock = currentStock();
    if (stock <= 0) return;
    let qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    qty = Math.min(qty, stock);
    qtyInput.value = String(qty);
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
    const [loadedProduct, loadedInfo, site] = await Promise.all([
      getProductByHandle(handle),
      loadJSON("./content/product-info.json").catch(() => DEFAULT_INFO),
      loadSite().catch(() => null),
    ]);
    product = loadedProduct;
    info = loadedInfo || DEFAULT_INFO;
    if (site?.freeShippingThresholdCents) {
      freeShippingThresholdCents = site.freeShippingThresholdCents;
    }
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
