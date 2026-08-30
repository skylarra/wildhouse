// Wildhouse Lane — shared UI helpers reused across pages (product cards,
// favorite toggles, and a lightweight toast) so markup is not duplicated.

import { formatMoney } from "./catalog.js";
import { isFavorite, toggleFavorite } from "./store.js";

const FALLBACK_IMG = "./assets/coming-soon.png";

export function productCardHTML(product) {
  const img = product.images[0] || FALLBACK_IMG;
  const priceLabel =
    product.hasVariants && product.minPriceCents !== product.maxPriceCents
      ? `From ${formatMoney(product.minPriceCents)}`
      : formatMoney(product.minPriceCents);
  const fav = isFavorite(product.id);
  const soldOut = product.inStock ? "" : '<span class="badge badge--soldout">Sold out</span>';
  // Optional future focal-point override (e.g. "50% 20%"). Defaults to centered cover crop.
  const imagePosition = product.imagePosition || product.custom?.imagePosition || "";
  const positionStyle = imagePosition
    ? ` style="--product-image-position: ${escapeHtml(String(imagePosition))}"`
    : "";

  return `
    <article class="product-card" data-item-id="${product.id}">
      <a class="product-card__link" href="./product.html?handle=${encodeURIComponent(product.handle)}">
        <div class="product-card__media img-placeholder">
          <img src="${img}" alt="${escapeHtml(product.name)}" loading="lazy" data-fallback="${FALLBACK_IMG}"${positionStyle}>
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

/** Remove shimmer placeholders once images load (or fall back on error). */
export function wireImagePlaceholders(container) {
  if (!container) return;
  container.querySelectorAll(".img-placeholder img").forEach((img) => {
    const parent = img.closest(".img-placeholder");
    const done = () => parent?.classList.remove("img-placeholder");
    const onError = () => {
      const fallback = img.dataset.fallback || FALLBACK_IMG;
      if (img.src && !img.src.endsWith(fallback.replace("./", ""))) {
        img.src = fallback;
      }
      done();
    };
    if (img.complete && img.naturalWidth > 0) {
      done();
      return;
    }
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", onError, { once: true });
  });
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

// Square-supported description HTML elements/attributes (CatalogItem.description_html).
const SQUARE_DESC_TAGS = new Set([
  "A", "B", "STRONG", "BR", "CODE", "DIV",
  "H1", "H2", "H3", "H4", "H5", "H6",
  "I", "EM", "LI", "OL", "P", "UL", "U", "SPAN",
]);
const SQUARE_DESC_ATTRS = {
  A: new Set(["href", "rel", "target", "align"]),
  DIV: new Set(["align"]),
  P: new Set(["align"]),
  H1: new Set(["align"]),
  H2: new Set(["align"]),
  H3: new Set(["align"]),
  H4: new Set(["align"]),
  H5: new Set(["align"]),
  H6: new Set(["align"]),
};

function isSafeHref(href) {
  if (!href) return false;
  const value = String(href).trim();
  // Allow http(s), mailto, tel, and in-site relative links only.
  return /^(https?:|mailto:|tel:|\/|\.\/|#)/i.test(value);
}

function sanitizeSquareNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const tag = node.tagName.toUpperCase();
  if (!SQUARE_DESC_TAGS.has(tag)) {
    // Keep children of unknown wrappers (e.g. <font>) without the wrapper itself.
    const frag = document.createDocumentFragment();
    node.childNodes.forEach((child) => {
      const cleaned = sanitizeSquareNode(child);
      if (cleaned) frag.appendChild(cleaned);
    });
    return frag;
  }

  const el = document.createElement(tag.toLowerCase());
  const allowed = SQUARE_DESC_ATTRS[tag];
  if (allowed) {
    for (const attr of node.attributes) {
      const name = attr.name.toLowerCase();
      if (!allowed.has(name)) continue;
      if (name === "href" && !isSafeHref(attr.value)) continue;
      if (name === "target") {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
        continue;
      }
      el.setAttribute(name, attr.value);
    }
  }
  node.childNodes.forEach((child) => {
    const cleaned = sanitizeSquareNode(child);
    if (cleaned) el.appendChild(cleaned);
  });
  return el;
}

/** Sanitize Square description_html down to the tags Square documents as supported. */
export function sanitizeSquareDescriptionHtml(html) {
  if (!html || typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return "";
  const out = document.createElement("div");
  root.childNodes.forEach((child) => {
    const cleaned = sanitizeSquareNode(child);
    if (cleaned) out.appendChild(cleaned);
  });
  return out.innerHTML.trim();
}

/**
 * Render a product description to match Square's spacing/formatting.
 * Prefers description_html; otherwise converts plain-text newlines to <p>/<br>.
 */
export function formatProductDescription({ html = "", text = "" } = {}) {
  const sanitized = html ? sanitizeSquareDescriptionHtml(html) : "";
  if (sanitized) return sanitized;

  const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";
  return normalized
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function collectionCardHTML(collection) {
  return `
    <a class="collection-card" href="./collection.html?handle=${encodeURIComponent(collection.handle)}">
      <div class="collection-card__media img-placeholder">
        <img src="${collection.image}" alt="${escapeHtml(collection.name)}" loading="lazy" data-fallback="${FALLBACK_IMG}">
      </div>
      <h3 class="collection-card__name">${escapeHtml(collection.name)}</h3>
    </a>`;
}
