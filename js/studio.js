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
  const parts = ["clasp", "bead", "mainShape", "mainArtwork", "mainBorder"]
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
  // Bead-strand mini clasps (gold/silver) are not section options.
  for (const src of Object.values(config.miniClasps || {})) {
    if (typeof src === "string" && /\.(png|svg|webp|jpe?g)$/i.test(src)) urls.add(src);
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
  return Math.max(1, Number(config.composition?.beadCount) || 5);
}

function miniCharmJumpRings() {
  return Math.max(1, Number(config.composition?.miniCharmJumpRings) || 3);
}

function mainCharmJumpRings() {
  return Math.max(1, Number(config.composition?.mainCharmJumpRings) || 1);
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

/** Dual-img layer used for crossfades without remounting. */
function layerSlot(slot, extraClass = "", style = "") {
  return `
    <span class="studio-layer ${extraClass}" data-slot="${slot}"${style ? ` style="${style}"` : ""}>
      <img class="studio-layer__img is-active" alt="" draggable="false">
      <img class="studio-layer__img studio-layer__next" alt="" draggable="false" aria-hidden="true">
    </span>`;
}

/**
 * Stable preview DOM matching the reference assembly:
 * clasp hub → LEFT 3 jump rings + mini charm
 *           → CENTER 1 jump ring + main charm (shape → artwork → border)
 *           → RIGHT mini clasp (gold/silver) then (jump ring → bead)… ending on a bead
 */
function previewHTML() {
  const miniRings = Array.from({ length: miniCharmJumpRings() }, (_, i) =>
    layerSlot(`miniRing-${i}`, "studio-layer--ring studio-layer--mini-ring", `--i:${i}`)
  ).join("");

  const mainRings = Array.from({ length: mainCharmJumpRings() }, (_, i) =>
    layerSlot(`mainRing-${i}`, "studio-layer--ring studio-layer--main-ring", `--i:${i}`)
  ).join("");

  // Pattern: mini clasp → jump ring → bead → jump ring → bead … end on bead
  const beadStrand = [layerSlot("beadMiniClasp", "studio-layer--mini-clasp")];
  for (let i = 0; i < beadCount(); i++) {
    beadStrand.push(
      layerSlot(`beadRing-${i}`, "studio-layer--ring studio-layer--bead-ring", `--i:${i}`)
    );
    beadStrand.push(
      layerSlot(`bead-${i}`, "studio-layer--bead", `--i:${i}`)
    );
  }

  return `
    <div class="studio-preview" aria-label="Live charm set preview">
      <div class="studio-preview__frame">
        <div class="studio-preview__compose studio-preview__compose--beads-${beadSide()} studio-preview__compose--mini-${miniSide()}">
          ${layerSlot("clasp", "studio-layer--clasp")}
          <div class="studio-branch studio-branch--mini" aria-hidden="true">
            ${miniRings}
            ${layerSlot("miniCharm", "studio-layer--mini")}
          </div>
          <div class="studio-branch studio-branch--main" aria-hidden="true">
            ${mainRings}
            <div class="studio-main-charm">
              ${layerSlot("mainShape", "studio-layer--main-shape")}
              ${layerSlot("mainArtwork", "studio-layer--main-artwork")}
              ${layerSlot("mainBorder", "studio-layer--main-border")}
            </div>
          </div>
          <div class="studio-branch studio-branch--beads" aria-hidden="true">
            ${beadStrand.join("")}
          </div>
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
  const shape = selectedOption("mainShape");
  const border = selectedOption("mainBorder");
  const artwork = selectedOption("mainArtwork");
  const mini = selectedOption("miniCharm");

  // Bead-strand mini clasp matches jump-ring metal (gold / silver only).
  const metal = ring?.metal || (ring?.id?.includes("silver") ? "silver" : "gold");
  const miniClaspSrc = config.miniClasps?.[metal] || config.miniClasps?.gold || null;

  setLayerImage(root.querySelector('[data-slot="clasp"]'), clasp?.image, { animate });
  setLayerImage(root.querySelector('[data-slot="mainShape"]'), shape?.image, { animate });
  setLayerImage(root.querySelector('[data-slot="mainArtwork"]'), artwork?.image, { animate });
  setLayerImage(root.querySelector('[data-slot="mainBorder"]'), border?.image, { animate });
  setLayerImage(root.querySelector('[data-slot="miniCharm"]'), mini?.image, { animate });
  setLayerImage(root.querySelector('[data-slot="beadMiniClasp"]'), miniClaspSrc, { animate });

  // All jump rings share the selected metal PNG.
  root.querySelectorAll(
    '[data-slot^="miniRing-"], [data-slot^="mainRing-"], [data-slot^="beadRing-"]'
  ).forEach((el) => {
    setLayerImage(el, ring?.image, { animate });
  });

  root.querySelectorAll('[data-slot^="bead-"]').forEach((el) => {
    if (el.dataset.slot === "beadMiniClasp") return;
    setLayerImage(el, bead?.image, { animate });
  });

  const summary = document.getElementById("studio-summary");
  if (summary) summary.textContent = designSummary();
  const price = document.getElementById("studio-price");
  if (price) price.textContent = formatMoney(priceCents());
}

function jumpRingIdForMetal(metal) {
  const section = sectionById("jumpRing");
  const match = (section?.options || []).find((o) => o.metal === metal);
  return match?.id || null;
}

/** Update chip selected state without remounting the card grid. */
function paintChipSelection(sectionId, optionId) {
  const grid = root.querySelector(`[data-card="${sectionId}"] .studio-chip-grid`);
  if (!grid) return;
  grid.querySelectorAll(".studio-chip").forEach((btn) => {
    const on = btn.dataset.option === optionId;
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-pressed", String(on));
  });
}

function selectOption(sectionId, optionId) {
  const section = sectionById(sectionId);
  if (!section || !optionById(section, optionId)) return;
  if (state[sectionId] === optionId) return;

  state[sectionId] = optionId;
  paintChipSelection(sectionId, optionId);

  // Gold / silver clasp hardware auto-selects matching jump rings
  // (mini clasps follow jump-ring metal in syncPreview).
  if (sectionId === "clasp") {
    const clasp = optionById(section, optionId);
    if (clasp?.metal === "gold" || clasp?.metal === "silver") {
      const ringId = jumpRingIdForMetal(clasp.metal);
      if (ringId && state.jumpRing !== ringId) {
        state.jumpRing = ringId;
        paintChipSelection("jumpRing", ringId);
      }
    }
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
  const shape = selectedOption("mainShape");
  addToCart(
    {
      variationId: designId,
      catalogVariationId: config.catalogVariationId,
      itemId: "ITEM_CUSTOM_KEYCHAIN",
      name: config.productName || "Build Your Own Charm Set",
      variationName: variationLabel(),
      note: designSummary(),
      priceCents: priceCents(),
      image:
        shape?.image ||
        selectedOption("clasp")?.image ||
        "./assets/studio/clasps/gold-lobster-clasp.png",
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
