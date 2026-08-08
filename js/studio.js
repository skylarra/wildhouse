// Keychain Studio — layered configurator.
// Data-driven via content/studio.json. Preview stays mounted; options crossfade layers.
import { loadJSON } from "./content.js";
import { formatMoney } from "./catalog.js";
import { addToCart } from "./store.js";
import { escapeHtml, toast } from "./ui.js";

const root = document.getElementById("studio-root");

let config = null;
/** @type {Record<string, string>} */
let state = {};
/** @type {"front"|"back"} */
let charmSide = "front";
const imageCache = new Map();

function sections() {
  return (config.sections || []).filter((s) => s.enabled !== false);
}

function sectionById(id) {
  return (config.sections || []).find((s) => s.id === id) || null;
}

function mainCharmSection() {
  return sectionById("mainCharm");
}

function optionById(list, optionId) {
  return (list || []).find((o) => o.id === optionId) || null;
}

function selectedFrom(list, key) {
  return optionById(list, state[key]);
}

function selectedOption(sectionId) {
  const section = sectionById(sectionId);
  if (!section) return null;
  if (section.layout === "mainCharm") return selectedFrom(section.shape?.options, "mainShape");
  return optionById(section.options, state[sectionId]);
}

function maxBeads() {
  return Math.max(1, Number(config.composition?.maxBeads) || 16);
}

/** Beads included in the strand addon before per-bead extras kick in. */
function includedBeads() {
  return Math.max(0, Number(config.composition?.includedBeads) || 8);
}

function extraBeadCents() {
  return Math.max(0, Number(config.extraBeadCents) || 10);
}

function beadWord() {
  return String(state.beadWord || "");
}

function priceCents() {
  let total = config.basePriceCents || 0;
  const count = beadWord().length;
  if (sectionById("beads")?.enabled !== false && count > 0) {
    total += config.beadedAddonCents || 0;
    // Beads beyond the included count are +10¢ each.
    const extras = Math.max(0, count - includedBeads());
    total += extras * extraBeadCents();
  }
  return total;
}

function designSummary() {
  const parts = [];
  const clasp = selectedOption("clasp");
  const ring = selectedOption("jumpRing");
  const shape = selectedFrom(mainCharmSection()?.shape?.options, "mainShape");
  const mini = selectedOption("miniCharm");

  if (clasp) parts.push(`Clasp: ${clasp.name}`);
  if (ring) parts.push(`Jump ring: ${ring.name}`);
  if (shape) parts.push(`Shape: ${shape.name}`);

  for (const side of ["front", "back"]) {
    const border = selectedFrom(mainCharmSection()?.borders?.options, `${side}Border`);
    const art = selectedFrom(mainCharmSection()?.artwork?.options, `${side}Artwork`);
    const letter = selectedFrom(mainCharmSection()?.letters?.options, `${side}Letter`);
    const label = side === "front" ? "Front" : "Back";
    const bits = [];
    if (border?.id && border.id !== "none") bits.push(border.name);
    if (art?.id && art.id !== "none") bits.push(art.name);
    if (letter?.id === "custom" && state[`${side}Text`]) bits.push(`“${state[`${side}Text`]}”`);
    else if (letter?.id && letter.id !== "none") bits.push(letter.name);
    if (bits.length) parts.push(`${label}: ${bits.join(" + ")}`);
  }

  if (mini) parts.push(`Mini: ${mini.name}`);
  if (beadWord()) parts.push(`Beads: ${beadWord().toUpperCase()}`);
  return parts.join(" · ");
}

function variationLabel() {
  const shape = selectedFrom(mainCharmSection()?.shape?.options, "mainShape")?.name;
  const beads = beadWord() ? beadWord().toUpperCase() : "";
  return [selectedOption("clasp")?.name, shape, beads].filter(Boolean).join(" · ");
}

function preloadImages() {
  const urls = new Set();
  const gather = (opts) => {
    for (const opt of opts || []) {
      if (opt.image) urls.add(opt.image);
    }
  };
  for (const section of config.sections || []) {
    gather(section.options);
    if (section.layout === "mainCharm") {
      gather(section.shape?.options);
      gather(section.borders?.options);
      gather(section.artwork?.options);
      gather(section.letters?.options);
    }
  }
  for (const src of Object.values(config.miniClasps || {})) {
    if (typeof src === "string") urls.add(src);
  }
  for (const src of Object.values(config.beadKeyboard?.assets || {})) {
    if (typeof src === "string") urls.add(src);
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

function layerSlot(slot, extraClass = "", style = "") {
  return `
    <span class="studio-layer ${extraClass}" data-slot="${slot}"${style ? ` style="${style}"` : ""}>
      <img class="studio-layer__img is-active" alt="" draggable="false">
      <img class="studio-layer__img studio-layer__next" alt="" draggable="false" aria-hidden="true">
    </span>`;
}

function previewHTML() {
  const max = maxBeads();
  const miniRings = Array.from({ length: miniCharmJumpRings() }, (_, i) =>
    layerSlot(`miniRing-${i}`, "studio-layer--ring studio-layer--mini-ring", `--i:${i}`)
  ).join("");

  const mainRings = Array.from({ length: mainCharmJumpRings() }, (_, i) =>
    layerSlot(`mainRing-${i}`, "studio-layer--ring studio-layer--main-ring", `--i:${i}`)
  ).join("");

  // Prebuild max bead slots; unused ones hide via CSS class.
  const beadStrand = [layerSlot("beadMiniClasp", "studio-layer--mini-clasp")];
  for (let i = 0; i < max; i++) {
    beadStrand.push(
      layerSlot(`beadRing-${i}`, "studio-layer--ring studio-layer--bead-ring", `--i:${i}`)
    );
    beadStrand.push(layerSlot(`bead-${i}`, "studio-layer--bead", `--i:${i}`));
  }

  return `
    <div class="studio-preview" aria-label="Live charm set preview">
      <div class="studio-preview__toolbar">
        <div class="studio-side-toggle" role="group" aria-label="Charm side">
          <button type="button" class="studio-side-toggle__btn is-active" data-charm-side="front">Front</button>
          <button type="button" class="studio-side-toggle__btn" data-charm-side="back">Back</button>
        </div>
      </div>
      <div class="studio-preview__frame">
        <div class="studio-preview__compose studio-preview__compose--beads-${beadSide()} studio-preview__compose--mini-${miniSide()}" data-charm-side="front">
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
              ${layerSlot("mainLetter", "studio-layer--main-letter")}
              <span class="studio-layer studio-layer--main-text" data-slot="mainText" hidden>
                <span class="studio-main-text" id="studio-main-text"></span>
              </span>
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

function chipHTML(sectionId, opt, selected, { compact = false } = {}) {
  const hasImage = Boolean(opt.image);
  return `
    <button type="button"
      class="studio-chip${compact ? " studio-chip--compact" : ""}${selected ? " is-selected" : ""}${!hasImage ? " studio-chip--plain" : ""}"
      data-section="${escapeHtml(sectionId)}"
      data-option="${escapeHtml(opt.id)}"
      aria-pressed="${selected}">
      ${
        hasImage
          ? `<span class="studio-chip__swatch"><img src="${opt.image}" alt="" width="40" height="40" decoding="async"></span>`
          : ""
      }
      <span class="studio-chip__name">${escapeHtml(opt.name)}</span>
    </button>`;
}

function chipGridHTML(sectionId, options, selectedId, { compact = false } = {}) {
  return `
    <div class="studio-chip-grid${compact ? " studio-chip-grid--compact" : ""}" role="group">
      ${(options || [])
        .map((opt) => chipHTML(sectionId, opt, opt.id === selectedId, { compact }))
        .join("")}
    </div>`;
}

function mainCharmCardHTML(section) {
  const side = charmSide;
  const borderKey = `${side}Border`;
  const artKey = `${side}Artwork`;
  const letterKey = `${side}Letter`;
  const textKey = `${side}Text`;
  const letter = state[letterKey];
  const showType = letter === "custom";

  return `
    <section class="studio-card studio-card--main" data-card="mainCharm">
      <h2 class="studio-card__title">${escapeHtml(section.title)}</h2>
      <p class="studio-card__body">${escapeHtml(section.body || "")}</p>

      <h3 class="studio-subhead">${escapeHtml(section.shape?.title || "Shape")}</h3>
      ${chipGridHTML("mainShape", section.shape?.options, state.mainShape)}

      <div class="studio-side-toggle studio-side-toggle--card" role="group" aria-label="Edit charm side">
        <button type="button" class="studio-side-toggle__btn${side === "front" ? " is-active" : ""}" data-charm-side="front">Front</button>
        <button type="button" class="studio-side-toggle__btn${side === "back" ? " is-active" : ""}" data-charm-side="back">Back</button>
      </div>

      <div class="studio-side-panel" data-side-panel>
        <h3 class="studio-subhead">${escapeHtml(section.borders?.title || "Border")}</h3>
        ${chipGridHTML(borderKey, section.borders?.options, state[borderKey], { compact: true })}

        <h3 class="studio-subhead">${escapeHtml(section.artwork?.title || "Artwork")}</h3>
        ${chipGridHTML(artKey, section.artwork?.options, state[artKey], { compact: true })}

        <h3 class="studio-subhead">${escapeHtml(section.letters?.title || "Letter / text")}</h3>
        <p class="studio-card__body studio-card__body--tight">${escapeHtml(section.letters?.body || "")}</p>
        ${chipGridHTML(letterKey, section.letters?.options, state[letterKey], { compact: true })}
        <label class="studio-text-field${showType ? "" : " is-hidden"}">
          <span class="visually-hidden">Custom text for ${side}</span>
          <input type="text" id="studio-${textKey}" data-side-text="${side}" maxlength="12"
            value="${escapeHtml(state[textKey] || "")}"
            placeholder="Type text for this side" autocomplete="off" />
        </label>
      </div>
    </section>`;
}

function beadKeyboardHTML(section) {
  const word = beadWord();
  const rows = config.beadKeyboard?.rows || [];
  const assets = config.beadKeyboard?.assets || {};
  const keys = rows
    .map((row) => {
      const buttons = row
        .map((key) => {
          const label = key === "heart" ? "♥" : key.toUpperCase();
          const img = assets[key];
          return `
            <button type="button" class="studio-key" data-bead-key="${escapeHtml(key)}" aria-label="${escapeHtml(label)}">
              ${img ? `<img src="${img}" alt="" decoding="async">` : ""}
              <span>${escapeHtml(label)}</span>
            </button>`;
        })
        .join("");
      return `<div class="studio-keyboard__row">${buttons}</div>`;
    })
    .join("");

  return `
    <section class="studio-card studio-card--beads" data-card="beads">
      <h2 class="studio-card__title">${escapeHtml(section.title)}</h2>
      <p class="studio-card__body">${escapeHtml(section.body || "")}</p>
      <p class="studio-bead-word" id="studio-bead-word" aria-live="polite">${
        word
          ? escapeHtml(word.toUpperCase())
          : '<span class="studio-bead-word__empty">Tap keys to spell…</span>'
      }</p>
      <div class="studio-keyboard" role="group" aria-label="Bead keyboard">
        ${keys}
        <div class="studio-keyboard__row studio-keyboard__row--actions">
          <button type="button" class="studio-key studio-key--wide" data-bead-action="backspace" aria-label="Delete last bead">⌫</button>
          <button type="button" class="studio-key studio-key--wide" data-bead-action="clear" aria-label="Clear beads">Clear</button>
        </div>
      </div>
    </section>`;
}

function sectionCardHTML(section) {
  if (section.layout === "mainCharm") return mainCharmCardHTML(section);
  if (section.layout === "beadKeyboard") return beadKeyboardHTML(section);

  return `
    <section class="studio-card" data-card="${escapeHtml(section.id)}">
      <h2 class="studio-card__title">${escapeHtml(section.title)}</h2>
      <p class="studio-card__body">${escapeHtml(section.body || "")}</p>
      ${chipGridHTML(section.id, section.options, state[section.id])}
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

function setLayerImage(layerEl, src, { animate = true } = {}) {
  if (!layerEl) return;
  const active = layerEl.querySelector(".studio-layer__img.is-active");
  const next = layerEl.querySelector(".studio-layer__img.studio-layer__next");

  if (!src) {
    layerEl.classList.add("is-empty");
    if (active) {
      active.removeAttribute("src");
      active.style.opacity = "0";
    }
    if (next) {
      next.removeAttribute("src");
      next.classList.remove("is-visible");
    }
    return;
  }

  layerEl.classList.remove("is-empty");
  if (active) active.style.opacity = "";
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

function beadAssetForChar(ch) {
  const key = ch === "♥" || ch === "❤" ? "heart" : String(ch).toLowerCase();
  return config.beadKeyboard?.assets?.[key] || null;
}

function syncBeadStrand({ animate = true } = {}) {
  const word = beadWord();
  const ring = selectedOption("jumpRing");
  const max = maxBeads();

  for (let i = 0; i < max; i++) {
    const ringEl = root.querySelector(`[data-slot="beadRing-${i}"]`);
    const beadEl = root.querySelector(`[data-slot="bead-${i}"]`);
    const ch = word[i];
    const show = Boolean(ch);
    ringEl?.classList.toggle("is-empty", !show);
    beadEl?.classList.toggle("is-empty", !show);
    if (show) {
      setLayerImage(ringEl, ring?.image, { animate });
      setLayerImage(beadEl, beadAssetForChar(ch), { animate });
    } else {
      setLayerImage(ringEl, null, { animate: false });
      setLayerImage(beadEl, null, { animate: false });
    }
  }

  const wordEl = document.getElementById("studio-bead-word");
  if (wordEl) {
    wordEl.innerHTML = word
      ? escapeHtml(word.toUpperCase())
      : `<span class="studio-bead-word__empty">Tap keys to spell…</span>`;
  }
}

function syncMainCharmSide({ animate = true } = {}) {
  const section = mainCharmSection();
  const shape = selectedFrom(section?.shape?.options, "mainShape");
  const border = selectedFrom(section?.borders?.options, `${charmSide}Border`);
  const artwork = selectedFrom(section?.artwork?.options, `${charmSide}Artwork`);
  const letter = selectedFrom(section?.letters?.options, `${charmSide}Letter`);
  const customText = String(state[`${charmSide}Text`] || "").trim();

  setLayerImage(root.querySelector('[data-slot="mainShape"]'), shape?.image, { animate });
  setLayerImage(root.querySelector('[data-slot="mainBorder"]'), border?.image || null, { animate });
  setLayerImage(root.querySelector('[data-slot="mainArtwork"]'), artwork?.image || null, { animate });

  const letterLayer = root.querySelector('[data-slot="mainLetter"]');
  const textLayer = root.querySelector('[data-slot="mainText"]');
  const textEl = document.getElementById("studio-main-text");

  if (letter?.id === "custom" && customText) {
    setLayerImage(letterLayer, null, { animate: false });
    if (textLayer) textLayer.hidden = false;
    if (textEl) textEl.textContent = customText;
  } else if (letter?.image) {
    if (textLayer) textLayer.hidden = true;
    if (textEl) textEl.textContent = "";
    setLayerImage(letterLayer, letter.image, { animate });
  } else {
    if (textLayer) textLayer.hidden = true;
    if (textEl) textEl.textContent = "";
    setLayerImage(letterLayer, null, { animate: false });
  }

  root.querySelector(".studio-preview__compose")?.setAttribute("data-charm-side", charmSide);
  root.querySelectorAll("[data-charm-side]").forEach((btn) => {
    if (!btn.classList.contains("studio-side-toggle__btn")) return;
    btn.classList.toggle("is-active", btn.dataset.charmSide === charmSide);
  });
}

function syncPreview({ animate = true } = {}) {
  const clasp = selectedOption("clasp");
  const ring = selectedOption("jumpRing");
  const mini = selectedOption("miniCharm");
  const metal = ring?.metal || (ring?.id?.includes("silver") ? "silver" : "gold");
  const miniClaspSrc = config.miniClasps?.[metal] || config.miniClasps?.gold || null;

  setLayerImage(root.querySelector('[data-slot="clasp"]'), clasp?.image, { animate });
  setLayerImage(root.querySelector('[data-slot="miniCharm"]'), mini?.image, { animate });
  setLayerImage(root.querySelector('[data-slot="beadMiniClasp"]'), miniClaspSrc, { animate });

  root.querySelectorAll('[data-slot^="miniRing-"], [data-slot^="mainRing-"]').forEach((el) => {
    setLayerImage(el, ring?.image, { animate });
  });

  syncMainCharmSide({ animate });
  syncBeadStrand({ animate });

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

function paintChipSelection(sectionId, optionId) {
  const card = root.querySelector(`[data-card="${sectionId}"], [data-card="mainCharm"]`);
  const scope = sectionId.startsWith("front") || sectionId.startsWith("back") || sectionId === "mainShape"
    ? root.querySelector('[data-card="mainCharm"]')
    : card;
  if (!scope) return;
  scope.querySelectorAll(`.studio-chip[data-section="${sectionId}"]`).forEach((btn) => {
    const on = btn.dataset.option === optionId;
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-pressed", String(on));
  });
}

function remountMainCharmPanel() {
  const section = mainCharmSection();
  const card = root.querySelector('[data-card="mainCharm"]');
  if (!section || !card) return;
  card.outerHTML = mainCharmCardHTML(section);
}

function setCharmSide(side) {
  if (side !== "front" && side !== "back") return;
  if (charmSide === side) {
    syncMainCharmSide({ animate: true });
    return;
  }
  charmSide = side;
  remountMainCharmPanel();
  syncPreview({ animate: true });
}

function selectOption(sectionId, optionId) {
  // Main-charm subkeys live on state directly.
  const main = mainCharmSection();
  let list = null;
  if (sectionId === "mainShape") list = main?.shape?.options;
  else if (sectionId.endsWith("Border")) list = main?.borders?.options;
  else if (sectionId.endsWith("Artwork")) list = main?.artwork?.options;
  else if (sectionId.endsWith("Letter")) list = main?.letters?.options;
  else list = sectionById(sectionId)?.options;

  if (!list || !optionById(list, optionId)) return;
  if (state[sectionId] === optionId) return;

  state[sectionId] = optionId;
  paintChipSelection(sectionId, optionId);

  if (sectionId.endsWith("Letter")) {
    const side = sectionId.startsWith("back") ? "back" : "front";
    const field = root.querySelector(`[data-side-text="${side}"]`)?.closest(".studio-text-field");
    field?.classList.toggle("is-hidden", optionId !== "custom");
  }

  if (sectionId === "clasp") {
    const clasp = optionById(list, optionId);
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

function appendBead(key) {
  const word = beadWord();
  if (word.length >= maxBeads()) {
    toast(`Up to ${maxBeads()} beads`);
    return;
  }
  if (!beadAssetForChar(key)) return;
  state.beadWord = word + (key === "heart" ? "♥" : key.toLowerCase());
  syncPreview({ animate: true });
}

function backspaceBead() {
  const word = beadWord();
  if (!word) return;
  state.beadWord = word.slice(0, -1);
  syncPreview({ animate: true });
}

function clearBeads() {
  if (!beadWord()) return;
  state.beadWord = "";
  syncPreview({ animate: true });
}

function wire() {
  const configEl = document.getElementById("studio-config");
  const previewCol = document.getElementById("studio-preview-col");

  const onClick = (e) => {
    const sideBtn = e.target.closest("[data-charm-side]");
    if (sideBtn) {
      e.preventDefault();
      setCharmSide(sideBtn.dataset.charmSide);
      return;
    }

    const beadKey = e.target.closest("[data-bead-key]");
    if (beadKey && configEl?.contains(beadKey)) {
      e.preventDefault();
      appendBead(beadKey.dataset.beadKey);
      return;
    }

    const beadAction = e.target.closest("[data-bead-action]");
    if (beadAction && configEl?.contains(beadAction)) {
      e.preventDefault();
      if (beadAction.dataset.beadAction === "backspace") backspaceBead();
      if (beadAction.dataset.beadAction === "clear") clearBeads();
      return;
    }

    const btn = e.target.closest(".studio-chip");
    if (!btn || !configEl?.contains(btn)) return;
    e.preventDefault();
    selectOption(btn.dataset.section, btn.dataset.option);
  };

  configEl?.addEventListener("click", onClick);
  previewCol?.addEventListener("click", onClick);

  configEl?.addEventListener("input", (e) => {
    const input = e.target.closest("[data-side-text]");
    if (!input) return;
    const side = input.dataset.sideText;
    state[`${side}Text`] = input.value;
    if (charmSide === side) syncMainCharmSide({ animate: false });
    const summary = document.getElementById("studio-summary");
    if (summary) summary.textContent = designSummary();
  });

  document.getElementById("studio-add")?.addEventListener("click", addDesignToCart);
}

function addDesignToCart() {
  const designId = `studio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const shape = selectedFrom(mainCharmSection()?.shape?.options, "mainShape");
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
      studioDesign: { ...state, charmSide },
    },
    1
  );
  toast("Added your charm set to cart");
}

function initState() {
  const defaults = config.defaults || {};
  state = {
    clasp: defaults.clasp || "",
    jumpRing: defaults.jumpRing || "",
    mainShape: defaults.mainShape || "",
    frontBorder: defaults.frontBorder || "none",
    frontArtwork: defaults.frontArtwork || "none",
    frontLetter: defaults.frontLetter || "none",
    frontText: defaults.frontText || "",
    backBorder: defaults.backBorder || "none",
    backArtwork: defaults.backArtwork || "none",
    backLetter: defaults.backLetter || "none",
    backText: defaults.backText || "",
    miniCharm: defaults.miniCharm || "",
    beadWord: defaults.beadWord || "",
  };

  // Fill from section options when defaults missing.
  for (const section of sections()) {
    if (section.layout === "chips" && !state[section.id]) {
      state[section.id] = section.options?.[0]?.id || "";
    }
  }
  charmSide = "front";
}

async function init() {
  try {
    config = await loadJSON("./content/studio.json");
  } catch (err) {
    root.innerHTML = `<div class="page-wrap"><p class="error">Could not load Keychain Studio.</p></div>`;
    console.error(err);
    return;
  }

  initState();
  document.title = `${config.title} | Wildhouse Lane`;
  root.innerHTML = shellHTML();
  wire();
  syncPreview({ animate: false });
  preloadImages();
}

init();
