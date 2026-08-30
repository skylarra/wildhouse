// Custom Orders page — showcase + Instagram / email reach-out (no form yet).
// Content: content/custom-orders.json
import { loadJSON } from "./content.js";
import { escapeHtml, wireImagePlaceholders } from "./ui.js";

const root = document.getElementById("custom-orders-root");

function linkAttrs(item) {
  const external = item.external || String(item.href || "").startsWith("http");
  return external ? ' target="_blank" rel="noopener noreferrer"' : "";
}

function ctaHTML(cta, cls = "btn secondary") {
  if (!cta?.href) return "";
  const style = cta.style === "primary" ? "btn primary" : cta.style === "secondary" ? "btn secondary" : cls;
  return `<a class="${style}" href="${escapeHtml(cta.href)}"${linkAttrs(cta)}>${escapeHtml(cta.label)}</a>`;
}

function renderHero(hero) {
  if (!hero) return "";
  const actions = (hero.ctas || (hero.cta ? [hero.cta] : []))
    .map((c, i) => ctaHTML(c, i === 0 ? "btn secondary" : "btn primary"))
    .join("");

  return `
    <section class="custom-hero" aria-labelledby="custom-hero-heading">
      <div class="custom-hero__inner page-wrap">
        <div class="custom-hero__copy">
          <h1 id="custom-hero-heading" class="custom-hero__heading homemade-apple-regular">${escapeHtml(hero.heading || "Custom Orders")}</h1>
          ${hero.tagline ? `<p class="custom-hero__tagline">${escapeHtml(hero.tagline)}</p>` : ""}
          <p class="custom-hero__body">${escapeHtml(hero.body || "")}</p>
          <div class="custom-hero__actions">${actions}</div>
        </div>
        ${
          hero.image
            ? `<div class="custom-hero__media img-placeholder">
                <img src="${escapeHtml(hero.image.src)}" alt="${escapeHtml(hero.image.alt || "")}" fetchpriority="high" data-fallback="./assets/coming-soon.png">
              </div>`
            : ""
        }
      </div>
    </section>`;
}

function renderShowcase(showcase) {
  if (!showcase?.items?.length) return "";
  const cards = showcase.items
    .map(
      (item) => `
      <li class="custom-showcase__item">
        <figure class="custom-showcase__card">
          <div class="custom-showcase__media img-placeholder">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt || item.title || "")}" loading="lazy" data-fallback="./assets/coming-soon.png">
          </div>
          <figcaption class="custom-showcase__caption">${escapeHtml(item.title || "")}</figcaption>
        </figure>
      </li>`
    )
    .join("");

  return `
    <section class="custom-showcase page-wrap" aria-labelledby="custom-showcase-heading">
      <h2 id="custom-showcase-heading">${escapeHtml(showcase.heading || "")}</h2>
      ${showcase.body ? `<p class="custom-section-lead">${escapeHtml(showcase.body)}</p>` : ""}
      <ul class="custom-showcase__grid">${cards}</ul>
    </section>`;
}

function renderContact(contact) {
  if (!contact) return "";
  const channels = (contact.channels || [])
    .map(
      (c) => `
      <li class="custom-reach__channel">
        <span class="custom-reach__label">${escapeHtml(c.label)}</span>
        <a class="custom-reach__link" href="${escapeHtml(c.href)}"${linkAttrs(c)}>${escapeHtml(c.value)}</a>
        ${c.hint ? `<span class="custom-reach__hint">${escapeHtml(c.hint)}</span>` : ""}
      </li>`
    )
    .join("");

  return `
    <section class="custom-reach" id="${escapeHtml(contact.id || "custom-reach-out")}" aria-labelledby="custom-reach-heading">
      <div class="page-wrap custom-reach__inner">
        <h2 id="custom-reach-heading">${escapeHtml(contact.heading || "")}</h2>
        ${contact.body ? `<p class="custom-section-lead">${escapeHtml(contact.body)}</p>` : ""}
        <ul class="custom-reach__list">${channels}</ul>
      </div>
    </section>`;
}

export async function initCustomOrdersPage() {
  if (!root) return;
  let data;
  try {
    data = await loadJSON("./content/custom-orders.json");
  } catch (err) {
    root.innerHTML = `<p class="error page-wrap">Could not load the custom orders page.</p>`;
    console.error(err);
    return;
  }

  if (data.seo?.title) document.title = data.seo.title;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && data.seo?.description) metaDesc.setAttribute("content", data.seo.description);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle && data.seo?.title) ogTitle.setAttribute("content", data.seo.title);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc && data.seo?.description) ogDesc.setAttribute("content", data.seo.description);

  root.innerHTML = [
    renderHero(data.hero),
    renderShowcase(data.showcase || data.gallery),
    renderContact(data.contact),
  ].join("\n");

  wireImagePlaceholders(root);
}

initCustomOrdersPage();
