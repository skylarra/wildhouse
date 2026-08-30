// Home page — renders all sections from content (home.json + events.json + notes.json),
// featured collections/products, destination previews, and recently viewed.
import {
  getFeaturedProducts,
  getBestSellingProducts,
  getProducts,
  getFeaturedCollections,
} from "./catalog.js";
import { loadPage } from "./content.js";
import { getRecentlyViewed } from "./store.js";
import { productCardHTML, wireFavorites, wireImagePlaceholders, escapeHtml, collectionCardHTML } from "./ui.js";

function ctaHTML(cta, cls = "btn secondary") {
  return cta ? `<a class="${cls}" href="${cta.href}">${escapeHtml(cta.label)}</a>` : "";
}

function renderSeo(seo) {
  const el = document.getElementById("seo-content");
  if (el && seo) {
    el.innerHTML = `<h1 class="page-intro__title">${escapeHtml(seo.heading)}</h1><p class="page-intro__body">${escapeHtml(seo.body)}</p>`;
  }
}

function renderHero(hero) {
  const el = document.getElementById("hero");
  if (!el || !hero) return;
  const stripImgs = (hero.images || [])
    .map((img, i) => {
      const eager = i === 0 ? ' fetchpriority="high"' : ' loading="lazy"';
      return `<img src="${img.src}" alt="${escapeHtml(img.alt || "")}"${eager}>`;
    })
    .join("");
  el.innerHTML = `
    <div class="hero-top">
      <img src="${hero.logo}" class="hero-logo" alt="${escapeHtml(hero.logoAlt || "")}" width="550" height="180">
    </div>
    <div class="hero-strip">${stripImgs}</div>
    <div class="hero-bottom">${ctaHTML(hero.cta)}</div>`;
}

function renderWelcome(w) {
  const el = document.getElementById("welcome");
  if (!el || !w) return;
  el.innerHTML = `
    <div class="welcome-first-img">
      <img src="${w.primaryImage.src}" alt="${escapeHtml(w.primaryImage.alt || "")}" loading="lazy">
    </div>
    <div class="welcome-content">
      <h2 class="homemade-apple-regular">${escapeHtml(w.eyebrow)}</h2>
      <h2 class="shadows-into-light-regular">${escapeHtml(w.heading)}</h2>
      <p>${escapeHtml(w.body)}</p>
      ${ctaHTML(w.cta, "btn primary")}
    </div>
    <div class="welcome-second-img">
      <img src="${w.secondaryImage.src}" alt="${escapeHtml(w.secondaryImage.alt || "")}" loading="lazy">
    </div>`;
}

function renderBanner(banner) {
  const el = document.getElementById("banner");
  if (el && banner) {
    el.innerHTML = `<img src="${banner.src}" alt="${escapeHtml(banner.alt || "")}" loading="lazy">`;
  }
}

function renderPreviews(previews) {
  const mount = document.getElementById("home-previews");
  if (!mount || !Array.isArray(previews) || !previews.length) return;

  mount.innerHTML = previews
    .map((p, i) => {
      const reverse = i % 2 === 1 ? " home-preview__inner--reverse" : "";
      const muted = i % 2 === 1 ? " home-preview--muted" : "";
      const img = p.image
        ? `<div class="home-preview__media"><img src="${p.image.src}" alt="${escapeHtml(p.image.alt || "")}" loading="lazy"></div>`
        : "";
      return `
        <section class="home-preview${muted}" id="preview-${escapeHtml(p.id || String(i))}">
          <div class="home-preview__inner${reverse}">
            ${img}
            <div class="home-preview__content">
              ${p.eyebrow ? `<p class="home-preview__eyebrow homemade-apple-regular">${escapeHtml(p.eyebrow)}</p>` : ""}
              <h2>${escapeHtml(p.heading || "")}</h2>
              <p>${escapeHtml(p.body || "")}</p>
              ${ctaHTML(p.cta, "btn primary")}
            </div>
          </div>
        </section>`;
    })
    .join("");
}

async function renderEventsPreview(preview) {
  const el = document.getElementById("events-preview");
  if (!el || !preview) return;
  let events = [];
  try {
    const data = await loadPage("events");
    events = data.events || [];
  } catch (err) {
    console.error(err);
  }
  const next = events[0];
  const card = next
    ? `<div class="event-card"><p><strong>${escapeHtml(next.name)}</strong> — ${escapeHtml(next.location)}</p><p>${escapeHtml(formatDate(next.date))}${next.time ? ` · ${escapeHtml(next.time)}` : ""}</p></div>`
    : `<div class="event-card"><p>More events coming soon.</p></div>`;
  el.innerHTML = `
    <h2>${escapeHtml(preview.heading)}</h2>
    <div class="event-grid">${card}</div>
    <div class="shop-button-container">${ctaHTML(preview.cta, "btn primary")}</div>`;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

/** Featured Products — Square Featured attribute only. Hide when none selected. */
async function renderFeaturedProducts(cfg = {}) {
  const section = document.getElementById("featured-products");
  const grid = document.getElementById("featured-grid");
  const heading = document.getElementById("featured-products-heading");
  const cta = document.getElementById("featured-products-cta");
  if (!section || !grid) return;

  try {
    const featured = await getFeaturedProducts(cfg.limit || 4);
    if (!featured.length) {
      section.hidden = true;
      return;
    }
    if (heading) heading.textContent = cfg.heading || "FEATURED PRODUCTS";
    if (cta) cta.innerHTML = ctaHTML(cfg.cta);
    grid.innerHTML = featured.map(productCardHTML).join("");
    wireFavorites(grid);
    wireImagePlaceholders(grid);
    section.hidden = false;
  } catch (err) {
    section.hidden = true;
    console.error(err);
  }
}

/**
 * Best Sellers — only when enabled AND real sales data exists.
 * Pre-launch: getBestSellingProducts() returns [] so this stays hidden.
 */
async function renderBestSellers(cfg = {}) {
  if (!cfg?.enabled) return;
  // Reserved mount point for a future dedicated section; do not reuse Featured Products markup.
  const products = await getBestSellingProducts(cfg.limit || 4);
  if (!products.length) return;
}

async function renderHomeCollections(cfg = {}) {
  const section = document.getElementById("home-collections");
  const grid = document.getElementById("home-collections-grid");
  const heading = document.getElementById("home-collections-heading");
  const cta = document.getElementById("home-collections-cta");
  if (!section || !grid) return;

  try {
    const featured = await getFeaturedCollections(cfg.limit || 6);
    if (!featured.length) {
      section.hidden = true;
      return;
    }
    if (heading && cfg.heading) heading.textContent = cfg.heading;
    if (cta) cta.innerHTML = ctaHTML(cfg.cta);
    grid.innerHTML = featured.map(collectionCardHTML).join("");
    wireImagePlaceholders(grid);
    section.hidden = false;
  } catch (err) {
    section.hidden = true;
    console.error(err);
  }
}

async function renderRecentlyViewed(heading) {
  const section = document.getElementById("recently-viewed");
  const grid = document.getElementById("recently-viewed-grid");
  const headingEl = document.getElementById("recently-viewed-heading");
  if (!section || !grid) return;
  const ids = getRecentlyViewed();
  if (!ids.length) return;
  const products = await getProducts();
  const items = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean);
  if (!items.length) return;
  if (headingEl && heading) headingEl.textContent = heading;
  grid.innerHTML = items.map(productCardHTML).join("");
  wireFavorites(grid);
  wireImagePlaceholders(grid);
  section.hidden = false;
}

async function init() {
  try {
    const home = await loadPage("home");
    renderSeo(home.seo);
    renderHero(home.hero);
    await renderHomeCollections(home.collections);
    // Prefer featuredProducts config; fall back to legacy bestSellers heading only if
    // someone still has old JSON — but never label featured products as best sellers.
    const featuredCfg = home.featuredProducts || {
      heading: "FEATURED PRODUCTS",
      cta: home.bestSellers?.cta,
    };
    await renderFeaturedProducts(featuredCfg);
    await renderBestSellers(home.bestSellers);
    renderPreviews(home.previews);
    renderWelcome(home.welcome);
    renderBanner(home.banner);
    await renderEventsPreview(home.eventsPreview);
    renderRecentlyViewed(home.recentlyViewedHeading);
  } catch (err) {
    console.error("Failed to load home content:", err);
  }
}

init();
