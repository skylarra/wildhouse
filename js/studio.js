// Keychain Studio — premium PNG-layer configurator.
// Data-driven via content/studio.json. Preview is a stable 4:5 composition;
// option changes crossfade a single layer (no full re-render, no scroll jump).
import { loadJSON } from "./content.js";
import { formatMoney } from "./catalog.js";
import { addToCart } from "./store.js";
import { escapeHtml, toast } from "./ui.js";

const root = document.getElementById("studio-root");

let config = null;
/** @type {Record<string, string>} sectionId → optionId */
let state = {};
const imageCache = new Map();

function sections() {
  return (config.sections || []).filter((s) => s.enabled !== false);
}

function sectionById(id) {
  return (config.sections || []).find((s) => s.id === id) || null;
}

function optionById(section, optionId) {
  return (section?.options || []).find((o) => o.id === optionId) || null;
}

function selectedOption(sectionId) {
  const section = sectionById(sectionId);
  return optionById(section, state[sectionId]);
}

function priceCents() {
  let total = config.basePriceCents || 0;
  // Bead section currently acts as the “beaded strand” addon when present.
  if (sectionById("bead")?.enabled !== false && state.bead) {
    total += config.beadedAddonCents || 0;
  }
  return total;
}

function designSummary() {
  return sections()
    .map((section) => {
      const opt = selectedOption(section.id);
      return `${section.title.replace(/^Choose\s+/i, "")}: ${opt?.name || "—"}`;
    })
    .join(" · ");
}

function variationLabel() {
  const parts = ["clasp", "bead", "mainCharm"]
    .map((id) => selectedOption(id)?.name)
    .filter(Boolean);
  return parts.join(" · ");
}

function preloadImages() {
  const urls = new Set();
  for (const section of config.sections || []) {
    for (const opt of section.options || []) {
      if (opt.image) urls.add(opt.image);
    }
  }
  return Promise.all(
    [...urls].map(
      (src) =>
        new Promise((resolve) => {
          if (imageCache.has(src)) return resolve(src);
          const img = new Image();
          img.decoding = "async";
          img.onload = () => {
            imageCache.set(src, img);
            resolve(src);
          };
          img.onerror = () => resolve(src);
          img.src = src;
        })
    )
  );
}

function beadCount() {
  return config.composition?.beadCount || 7;
}

function beadSide() {
  return config.composition?.beadSide === "left" ? "left" : "right";
}

function miniSide() {
  return config.composition?.miniCharmSide === "right" ? "right" : "left";
}

function crossfadeMs() {
  return config.composition?.crossfadeMs || 200;
}

/** Build stable preview layer DOM once. */
function previewHTML() {
  const beads = Array.from({ length: beadCount() }, (_, i) => {
    return `<span class="studio-layer studio-layer--bead" data-bead-index="${i}" style="--i:${i}">
      <img class="studio-layer__img is-active" alt="" draggable="false">
      <img class="studio-layer__img studio-layer__next" alt="" draggable="false" aria-hidden="true">
    </span>`;
  }).join("");

  return `
    <div class="studio-preview" aria-label="Live charm set preview">
      <div class="studio-preview__frame">
        <div class="studio-preview__compose studio-preview__compose--beads-${beadSide()} studio-preview__compose--mini-${miniSide()}">
          <span class="studio-layer studio-layer--clasp" data-slot="clasp">
            <img class="studio-layer__img is-active" alt="" draggable="false">
            <img class="studio-layer__img studio-layer__next" alt="" draggable="false" aria-hidden="true">
          </span>
          <span class="studio-layer studio-layer--ring-top" data-slot="jumpRingTop">
            <img class="studio-layer__img is-active" alt="" draggable="false">
            <img class="studio-layer__img studio-layer__next" alt="" draggable="false" aria-hidden="true">
          </span>
          <span class="studio-layer studio-layer--main" data-slot="mainCharm">
            <img class="studio-layer__img is-active" alt="" draggable="false">
            <img class="studio-layer__img studio-layer__next" alt="" draggable="false" aria-hidden="true">
          </span>
          <span class="studio-layer studio-layer--ring-mini" data-slot="jumpRingMini">
            <img class="studio-layer__img is-active" alt="" draggable="false">
            <img class="studio-layer__img studio-layer__next" alt="" draggable="false" aria-hidden="true">
          </span>
          <span class="studio-layer studio-layer--mini" data-slot="miniCharm">
            <img class="studio-layer__img is-active" alt="" draggable="false">
            <img class="studio-layer__img studio-layer__next" alt="" draggable="false" aria-hidden="true">
          </span>
          <span class="studio-layer studio-layer--ring-bead" data-slot="jumpRingBead">
            <img class="studio-layer__img is-active" alt="" draggable="false">
            <img class="studio-layer__img studio-layer__next" alt="" draggable="false" aria-hidden="true">
          </span>
          <div class="studio-beads" data-slot="beads" aria-hidden="true">${beads}</div>
        </div>
      </div>
      <p class="studio-preview__hint">${escapeHtml(config.previewHint || "")}</p>
      <p class="studio-preview__summary" id="studio-summary"></p>
    </div>`;
}

function optionButtonHTML(section, opt, selected) {
  return `
    <button type="button"
      class="studio-chip${selected ? " is-selected" : ""}"
      data-section="${escapeHtml(section.id)}"
      data-option="${escapeHtml(opt.id)}"
      aria-pressed="${selected}">
      <span class="studio-chip__swatch">
        <img src="${opt.image}" alt="" width="40" height="40" decoding="async">
      </span>
      <span class="studio-chip__name">${escapeHtml(opt.name)}</span>
    </button>`;
}

function sectionCardHTML(section) {
  const selected = state[section.id];
  return `
    <section class="studio-card" data-card="${escapeHtml(section.id)}">
      <h2 class="studio-card__title">${escapeHtml(section.title)}</h2>
      <p class="studio-card__body">${escapeHtml(section.body || "")}</p>
      <div class="studio-chip-grid" role="group" aria-label="${escapeHtml(section.title)}">
        ${(section.options || [])
          .map((opt) => optionButtonHTML(section, opt, opt.id === selected))
          .join("")}
      </div>
    </section>`;
}

function shellHTML() {
  return `
    <div class="studio-hero page-wrap">
      <h1 class="page-title">${escapeHtml(config.title)}</h1>
      <p class="studio-intro">${escapeHtml(config.intro)}</p>
    </div>
    <div class="studio-layout page-wrap">
      <div class="studio-config" id="studio-config">
        ${sections().map(sectionCardHTML).join("")}
      </div>
      <aside class="studio-preview-col" id="studio-preview-col">
        ${previewHTML()}
        <div class="studio-checkout">
          <p class="studio-price" id="studio-price">${formatMoney(priceCents())}</p>
          <button type="button" class="btn secondary" id="studio-add">${escapeHtml(config.addToCartLabel || "Add to cart")}</button>
        </div>
      </aside>
    </div>`;
}

/**
 * Crossfade a layer’s active image to a new src without remounting the tree.
 * Preserves scroll — never touches layout outside the layer.
 */
function setLayerImage(layerEl, src, { animate = true } = {}) {
  if (!layerEl || !src) return;
  const active = layerEl.querySelector(".studio-layer__img.is-active");
  const next = layerEl.querySelector(".studio-layer__img.studio-layer__next");
  if (!active) return;

  if (!animate || active.getAttribute("src") === src || !active.getAttribute("src")) {
    active.src = src;
    if (next) {
      next.src = src;
      next.classList.remove("is-visible");
    }
    return;
  }

  if (!next) {
    active.src = src;
    return;
  }

  next.src = src;
  next.classList.add("is-visible");
  window.setTimeout(() => {
    active.src = src;
    next.classList.remove("is-visible");
  }, crossfadeMs());
}

function syncPreview({ animate = true } = {}) {
  const clasp = selectedOption("clasp");
  const ring = selectedOption("jumpRing");
  const bead = selectedOption("bead");
  const main = selectedOption("mainCharm");
  const mini = selectedOption("miniCharm");

  setLayerImage(root.querySelector('[data-slot="clasp"]'), clasp?.image, { animate });
  setLayerImage(root.querySelector('[data-slot="jumpRingTop"]'), ring?.image, { animate });
  setLayerImage(root.querySelector('[data-slot="jumpRingMini"]'), ring?.image, { animate });
  setLayerImage(root.querySelector('[data-slot="jumpRingBead"]'), ring?.image, { animate });
  setLayerImage(root.querySelector('[data-slot="mainCharm"]'), main?.image, { animate });
  setLayerImage(root.querySelector('[data-slot="miniCharm"]'), mini?.image, { animate });

  root.querySelectorAll("[data-bead-index]").forEach((el) => {
    setLayerImage(el, bead?.image, { animate });
  });

  const summary = document.getElementById("studio-summary");
  if (summary) summary.textContent = designSummary();
  const price = document.getElementById("studio-price");
  if (price) price.textContent = formatMoney(priceCents());
}

function selectOption(sectionId, optionId) {
  const section = sectionById(sectionId);
  if (!section || !optionById(section, optionId)) return;
  if (state[sectionId] === optionId) return;

  state[sectionId] = optionId;

  // Update selected styles in-place — equal-size chips, no reflow of card structure.
  const grid = root.querySelector(`[data-card="${sectionId}"] .studio-chip-grid`);
  if (grid) {
    grid.querySelectorAll(".studio-chip").forEach((btn) => {
      const on = btn.dataset.option === optionId;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", String(on));
    });
  }

  syncPreview({ animate: true });
}

function wire() {
  const configEl = document.getElementById("studio-config");
  // Event delegation — avoids rebinding; clicks never call scrollIntoView.
  configEl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".studio-chip");
    if (!btn || !configEl.contains(btn)) return;
    e.preventDefault();
    selectOption(btn.dataset.section, btn.dataset.option);
  });

  document.getElementById("studio-add")?.addEventListener("click", addDesignToCart);
}

function addDesignToCart() {
  const designId = `studio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const main = selectedOption("mainCharm");
  addToCart(
    {
      variationId: designId,
      catalogVariationId: config.catalogVariationId,
      itemId: "ITEM_CUSTOM_KEYCHAIN",
      name: config.productName || "Build Your Own Charm Set",
      variationName: variationLabel(),
      note: designSummary(),
      priceCents: priceCents(),
      image: main?.image || selectedOption("clasp")?.image || "./assets/studio/clasps/gold.png",
      handle: config.productHandle || "custom-keychain",
      studioDesign: { ...state },
    },
    1
  );
  toast("Added your charm set to cart");
}

async function init() {
  try {
    config = await loadJSON("./content/studio.json");
  } catch (err) {
    root.innerHTML = `<div class="page-wrap"><p class="error">Could not load Keychain Studio.</p></div>`;
    console.error(err);
    return;
  }

  const defaults = config.defaults || {};
  state = {};
  for (const section of config.sections || []) {
    if (section.enabled === false) continue;
    state[section.id] =
      defaults[section.id] ||
      section.options?.[0]?.id ||
      "";
  }

  document.title = `${config.title} | Wildhouse Lane`;
  root.innerHTML = shellHTML();
  wire();
  syncPreview({ animate: false });
  preloadImages();
}

init();
