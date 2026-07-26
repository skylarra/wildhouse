// Home page — renders all sections from content (home.json + events.json) and
// the featured "best sellers" + recently-viewed products from the catalog.
import { getFeatured, getProducts } from "./catalog.js";
import { loadPage } from "./content.js";
import { getRecentlyViewed } from "./store.js";
import { productCardHTML, wireFavorites, escapeHtml } from "./ui.js";

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

function renderBestSellersChrome(bs) {
  if (!bs) return;
  const heading = document.getElementById("best-sellers-heading");
  const cta = document.getElementById("best-sellers-cta");
  if (heading && bs.heading) heading.textContent = bs.heading;
  if (cta) cta.innerHTML = ctaHTML(bs.cta);
}

function renderWelcome(w) {
  const el = document.getElementById("welcome");
  if (!el || !w) return;
  el.innerHTML = `
    <div class="welcome-first-img">
      <img src="${w.primaryImage.src}" alt="${escapeHtml(w.primaryImage.alt || "")}" loading="lazy">
    </div>
    <div class="welcome-content">
      <p class="homemade-apple-regular welcome-eyebrow">${escapeHtml(w.eyebrow)}</p>
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

async function renderFeatured() {
  const grid = document.getElementById("featured-grid");
  if (!grid) return;
  try {
    const featured = await getFeatured(4);
    grid.innerHTML = featured.map(productCardHTML).join("");
    wireFavorites(grid);
  } catch (err) {
    grid.innerHTML = `<p class="error">Could not load products right now.</p>`;
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
  section.hidden = false;
}

async function init() {
  renderFeatured();
  try {
    const home = await loadPage("home");
    renderSeo(home.seo);
    renderHero(home.hero);
    renderBestSellersChrome(home.bestSellers);
    renderWelcome(home.welcome);
    renderBanner(home.banner);
    await renderEventsPreview(home.eventsPreview);
    renderRecentlyViewed(home.recentlyViewedHeading);
  } catch (err) {
    console.error("Failed to load home content:", err);
  }
}

init();
