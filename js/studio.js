// Keychain Studio — layered SVG/PNG builder (no Canvas / 3D).
// Config lives in content/studio.json. Preview is stacked <img> layers.
import { loadJSON } from "./content.js";
import { formatMoney } from "./catalog.js";
import { addToCart } from "./store.js";
import { escapeHtml, toast } from "./ui.js";

const root = document.getElementById("studio-root");

let config = null;
let state = null;
let activeBeadTab = "letters";

function byId(list, id) {
  return (list || []).find((item) => item.id === id) || null;
}

function allBeads() {
  return (config.beadTabs || []).flatMap((tab) => tab.items || []);
}

function priceCents() {
  let total = config.basePriceCents || 0;
  if (state.styleId === "beaded") total += config.beadedAddonCents || 0;
  return total;
}

function designSummary() {
  const hardware = byId(config.hardware, state.hardwareId)?.label || state.hardwareId;
  const style = byId(config.styles, state.styleId)?.label || state.styleId;
  const main = byId(config.mainCharms, state.mainCharmId)?.label || state.mainCharmId;
  const mini = byId(config.miniCharms, state.miniCharmId)?.label || state.miniCharmId;
  const beadLabels = state.beads
    .map((id) => allBeads().find((b) => b.id === id)?.label || id)
    .join("");
  const parts = [`Hardware: ${hardware}`, `Style: ${style}`];
  if (state.styleId === "beaded") {
    parts.push(`Beads: ${beadLabels || "(none)"}`);
  }
  parts.push(`Main: ${main}`, `Mini: ${mini}`);
  return parts.join(" · ");
}

function designNote() {
  return designSummary();
}

function variationLabel() {
  const hardware = byId(config.hardware, state.hardwareId)?.label || "";
  const style = byId(config.styles, state.styleId)?.label || "";
  const main = byId(config.mainCharms, state.mainCharmId)?.label || "";
  if (state.styleId === "beaded" && state.beads.length) {
    const word = state.beads
      .map((id) => allBeads().find((b) => b.id === id))
      .filter((b) => b && b.kind === "letter")
      .map((b) => b.label)
      .join("");
    return [hardware, style, word || "beaded", main].filter(Boolean).join(" · ");
  }
  return [hardware, style, main].filter(Boolean).join(" · ");
}

function optionCard({ id, label, layer, description, selected, group }) {
  const media = layer
    ? `<span class="studio-option__media"><img src="${layer}" alt="" loading="lazy"></span>`
    : "";
  const desc = description
    ? `<span class="studio-option__desc">${escapeHtml(description)}</span>`
    : "";
  return `
    <button type="button"
      class="studio-option${selected ? " is-selected" : ""}"
      data-group="${group}"
      data-id="${escapeHtml(id)}"
      aria-pressed="${selected}">
      ${media}
      <span class="studio-option__label">${escapeHtml(label)}</span>
      ${desc}
    </button>`;
}

function renderPreview() {
  const hardware = byId(config.hardware, state.hardwareId);
  const main = byId(config.mainCharms, state.mainCharmId);
  const mini = byId(config.miniCharms, state.miniCharmId);
  const beadLayers = state.beads
    .map((id) => allBeads().find((b) => b.id === id))
    .filter(Boolean);

  const beadHTML =
    state.styleId === "beaded"
      ? `<div class="studio-preview__beads" aria-hidden="true">
          ${beadLayers
            .map(
              (b, i) =>
                `<img class="studio-preview__bead" src="${b.layer}" alt="" style="--i:${i}" loading="lazy">`
            )
            .join("")}
        </div>`
      : "";

  return `
    <div class="studio-preview" aria-label="Live keychain preview">
      <div class="studio-preview__stage${state.styleId === "beaded" ? " is-beaded" : ""}">
        ${
          hardware
            ? `<img class="studio-preview__layer studio-preview__hardware" src="${hardware.layer}" alt="" loading="lazy">`
            : ""
        }
        ${beadHTML}
        ${
          main
            ? `<img class="studio-preview__layer studio-preview__main" src="${main.layer}" alt="" loading="lazy">`
            : ""
        }
        ${
          mini
            ? `<img class="studio-preview__layer studio-preview__mini" src="${mini.layer}" alt="" loading="lazy">`
            : ""
        }
      </div>
      <p class="studio-preview__hint">${escapeHtml(config.previewHint || "")}</p>
      <p class="studio-preview__summary" id="studio-summary">${escapeHtml(designSummary())}</p>
    </div>`;
}

function renderBeadBuilder() {
  if (state.styleId !== "beaded") return "";
  const steps = config.steps.beads;
  const tab = (config.beadTabs || []).find((t) => t.id === activeBeadTab) || config.beadTabs[0];
  const tabs = (config.beadTabs || [])
    .map(
      (t) =>
        `<button type="button" class="studio-tab${t.id === tab.id ? " is-active" : ""}" data-bead-tab="${t.id}">${escapeHtml(t.label)}</button>`
    )
    .join("");
  const palette = (tab?.items || [])
    .map(
      (item) => `
      <button type="button" class="studio-bead-pick" data-add-bead="${escapeHtml(item.id)}" aria-label="Add ${escapeHtml(item.label)} bead">
        <img src="${item.layer}" alt="" loading="lazy">
        <span>${escapeHtml(item.label)}</span>
      </button>`
    )
    .join("");
  const sequence = state.beads.length
    ? state.beads
        .map((id, index) => {
          const bead = allBeads().find((b) => b.id === id);
          if (!bead) return "";
          return `
            <button type="button" class="studio-bead-slot" data-remove-bead="${index}" aria-label="Remove ${escapeHtml(bead.label)}">
              <img src="${bead.layer}" alt="">
            </button>`;
        })
        .join("")
    : `<p class="studio-empty">No beads yet — pick letters, colors, or shapes.</p>`;

  return `
    <section class="studio-step" id="step-beads">
      <h2>${escapeHtml(steps.heading)}</h2>
      <p>${escapeHtml(steps.body)}</p>
      <div class="studio-sequence" aria-label="Current bead sequence">${sequence}</div>
      <p class="studio-count">${state.beads.length} / ${config.maxBeads} beads</p>
      <div class="studio-tabs" role="tablist">${tabs}</div>
      <div class="studio-bead-palette">${palette}</div>
    </section>`;
}

function render() {
  const hw = config.steps.hardware;
  const st = config.steps.style;
  const main = config.steps.mainCharm;
  const mini = config.steps.miniCharm;

  root.innerHTML = `
    <div class="studio-hero page-wrap">
      <h1 class="page-title">${escapeHtml(config.title)}</h1>
      <p class="studio-intro">${escapeHtml(config.intro)}</p>
    </div>
    <div class="studio-layout page-wrap">
      <aside class="studio-preview-col" aria-live="polite">
        ${renderPreview()}
        <div class="studio-checkout">
          <p class="studio-price" id="studio-price">${formatMoney(priceCents())}</p>
          <button type="button" class="btn secondary" id="studio-add">${escapeHtml(config.addToCartLabel || "Add to cart")}</button>
        </div>
      </aside>
      <div class="studio-steps">
        <section class="studio-step">
          <h2>${escapeHtml(hw.heading)}</h2>
          <p>${escapeHtml(hw.body)}</p>
          <div class="studio-options studio-options--hardware">
            ${config.hardware
              .map((item) =>
                optionCard({
                  ...item,
                  selected: item.id === state.hardwareId,
                  group: "hardware",
                })
              )
              .join("")}
          </div>
        </section>

        <section class="studio-step">
          <h2>${escapeHtml(st.heading)}</h2>
          <p>${escapeHtml(st.body)}</p>
          <div class="studio-options studio-options--style">
            ${config.styles
              .map((item) =>
                optionCard({
                  id: item.id,
                  label: item.label,
                  description: item.description,
                  selected: item.id === state.styleId,
                  group: "style",
                })
              )
              .join("")}
          </div>
        </section>

        ${renderBeadBuilder()}

        <section class="studio-step">
          <h2>${escapeHtml(main.heading)}</h2>
          <p>${escapeHtml(main.body)}</p>
          <div class="studio-options studio-options--charms">
            ${config.mainCharms
              .map((item) =>
                optionCard({
                  ...item,
                  selected: item.id === state.mainCharmId,
                  group: "main",
                })
              )
              .join("")}
          </div>
        </section>

        <section class="studio-step">
          <h2>${escapeHtml(mini.heading)}</h2>
          <p>${escapeHtml(mini.body)}</p>
          <div class="studio-options studio-options--mini">
            ${config.miniCharms
              .map((item) =>
                optionCard({
                  ...item,
                  selected: item.id === state.miniCharmId,
                  group: "mini",
                })
              )
              .join("")}
          </div>
        </section>
      </div>
    </div>`;

  wire();
}

function refreshPreviewOnly() {
  const col = root.querySelector(".studio-preview-col");
  if (!col) return;
  const checkout = col.querySelector(".studio-checkout")?.outerHTML || "";
  col.innerHTML = `${renderPreview()}${checkout}`;
  const price = document.getElementById("studio-price");
  if (price) price.textContent = formatMoney(priceCents());
  document.getElementById("studio-add")?.addEventListener("click", addDesignToCart);
}

function wire() {
  root.querySelectorAll(".studio-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      const group = btn.dataset.group;
      const id = btn.dataset.id;
      if (group === "hardware") state.hardwareId = id;
      if (group === "style") {
        state.styleId = id;
        if (id !== "beaded") state.beads = [];
        render();
        return;
      }
      if (group === "main") state.mainCharmId = id;
      if (group === "mini") state.miniCharmId = id;
      root.querySelectorAll(`.studio-option[data-group="${group}"]`).forEach((el) => {
        const on = el.dataset.id === id;
        el.classList.toggle("is-selected", on);
        el.setAttribute("aria-pressed", String(on));
      });
      refreshPreviewOnly();
    });
  });

  root.querySelectorAll("[data-bead-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeBeadTab = btn.dataset.beadTab;
      render();
      document.getElementById("step-beads")?.scrollIntoView({ block: "nearest" });
    });
  });

  root.querySelectorAll("[data-add-bead]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.beads.length >= (config.maxBeads || 10)) {
        toast(`You can add up to ${config.maxBeads} beads.`);
        return;
      }
      state.beads.push(btn.dataset.addBead);
      render();
      document.getElementById("step-beads")?.scrollIntoView({ block: "nearest" });
    });
  });

  root.querySelectorAll("[data-remove-bead]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.removeBead);
      state.beads.splice(index, 1);
      render();
      document.getElementById("step-beads")?.scrollIntoView({ block: "nearest" });
    });
  });

  document.getElementById("studio-add")?.addEventListener("click", addDesignToCart);
}

function addDesignToCart() {
  if (state.styleId === "beaded" && !state.beads.length) {
    toast("Add at least one bead, or switch to Standard.");
    return;
  }
  const designId = `studio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const main = byId(config.mainCharms, state.mainCharmId);
  addToCart(
    {
      // Unique per design so different builds don't merge in the cart.
      variationId: designId,
      catalogVariationId: config.catalogVariationId,
      itemId: "ITEM_CUSTOM_KEYCHAIN",
      name: config.productName || "Custom Keychain",
      variationName: variationLabel(),
      note: designNote(),
      priceCents: priceCents(),
      image: main?.layer || "./assets/studio/charms/tree.svg",
      handle: config.productHandle || "custom-keychain",
      studioDesign: {
        hardwareId: state.hardwareId,
        styleId: state.styleId,
        beads: [...state.beads],
        mainCharmId: state.mainCharmId,
        miniCharmId: state.miniCharmId,
      },
    },
    1
  );
  toast("Added your keychain design to cart");
}

async function init() {
  try {
    config = await loadJSON("./content/studio.json");
  } catch (err) {
    root.innerHTML = `<div class="page-wrap"><p class="error">Could not load Keychain Studio.</p></div>`;
    console.error(err);
    return;
  }

  const d = config.defaults || {};
  state = {
    hardwareId: d.hardwareId || config.hardware[0]?.id,
    styleId: d.styleId || "standard",
    mainCharmId: d.mainCharmId || config.mainCharms[0]?.id,
    miniCharmId: d.miniCharmId || config.miniCharms[0]?.id,
    beads: Array.isArray(d.beads) ? [...d.beads] : [],
  };

  document.title = `${config.title} | Wildhouse Lane`;
  render();
}

init();
