// Wildhouse Lane — reusable layout components.
// Renders the announcement bar, header/nav, newsletter, and footer into the
// placeholder containers present on every page. All content comes from
// content/site.json via js/content.js — no copy is hardcoded here.

import { loadSite } from "./content.js";
import { cartCount, getPref, setPref } from "./store.js";
import { escapeHtml } from "./ui.js";

const currentFile = location.pathname.split("/").pop() || "index.html";

function isActive(href) {
  const file = href.split("/").pop();
  return file === currentFile || (currentFile === "" && file === "index.html");
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

/* ------------------------- Announcement bar ------------------------- */
function mountAnnouncement(announcement) {
  const el = document.getElementById("site-announcement");
  if (!el || !announcement || !announcement.messages?.length) return;

  if (announcement.dismissible && getPref("announcementDismissed") === true) {
    el.hidden = true;
    return;
  }

  el.innerHTML = `
    <div class="announcement" role="region" aria-label="Announcements">
      <p class="announcement__text" aria-live="polite">${escapeHtml(announcement.messages[0])}</p>
      ${announcement.dismissible ? '<button class="announcement__close" type="button" aria-label="Dismiss announcement">&times;</button>' : ""}
    </div>`;

  const textEl = el.querySelector(".announcement__text");
  if (announcement.messages.length > 1 && !prefersReducedMotion()) {
    let i = 0;
    setInterval(() => {
      i = (i + 1) % announcement.messages.length;
      textEl.textContent = announcement.messages[i];
    }, announcement.rotateMs || 4500);
  }

  const closeBtn = el.querySelector(".announcement__close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      setPref("announcementDismissed", true);
      el.hidden = true;
    });
  }
}

/* ------------------------------ Header ------------------------------ */
function setNavOpen(navToggle, navLinks, isOpen) {
  navLinks.classList.toggle("active", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
  navToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
}

function mountHeader(site) {
  const el = document.getElementById("site-header");
  if (!el) return;

  const links = site.nav
    .map(
      (item) =>
        `<a href="${item.href}"${isActive(item.href) ? ' aria-current="page"' : ""}>${escapeHtml(item.label)}</a>`
    )
    .join("");

  el.innerHTML = `
    <nav class="nav" aria-label="Primary">
      <a href="./index.html" class="nav-brand" aria-label="${escapeHtml(site.brand)} home">
        <img src="${site.logos.submark}" class="nav-logo" alt="${escapeHtml(site.brand)}">
      </a>
      <div class="nav-links" id="navLinks">${links}</div>
      <div class="nav-actions">
        <a class="nav-cart" href="./cart.html" id="navCartLink" aria-label="Cart">
          <img src="./assets/cart-icon.svg" alt="">
          <span class="cart-badge" id="cartBadge" hidden>0</span>
        </a>
        <button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="navLinks" aria-label="Open navigation menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>
    <div class="hero-section-divider"></div>`;

  const navToggle = el.querySelector("#navToggle");
  const navLinks = el.querySelector("#navLinks");
  navToggle.addEventListener("click", () => {
    setNavOpen(navToggle, navLinks, !navLinks.classList.contains("active"));
  });
  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setNavOpen(navToggle, navLinks, false));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navLinks.classList.contains("active")) {
      setNavOpen(navToggle, navLinks, false);
      navToggle.focus();
    }
  });

  updateCartBadge();
}

export function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  const cartLink = document.getElementById("navCartLink");
  const count = cartCount();
  if (badge) {
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }
  if (cartLink) {
    cartLink.setAttribute("aria-label", count === 0 ? "Cart" : `Cart, ${count} ${count === 1 ? "item" : "items"}`);
  }
}

/* ---------------------------- Newsletter ---------------------------- */
function mountNewsletter(n) {
  const el = document.getElementById("site-newsletter");
  if (!el || !n) return;

  el.innerHTML = `
    <section class="newsletter" aria-labelledby="newsletter-heading">
      <h2 id="newsletter-heading" class="shadows-into-light-regular">${escapeHtml(n.heading)}</h2>
      <p>${escapeHtml(n.body)}</p>
      <form class="newsletter__form" novalidate>
        <label class="visually-hidden" for="newsletter-email">Email address</label>
        <input type="email" id="newsletter-email" name="email" placeholder="${escapeHtml(n.placeholder)}" autocomplete="email" required>
        <button type="submit" class="btn secondary">${escapeHtml(n.buttonLabel)}</button>
      </form>
      <p class="newsletter__message" role="status" aria-live="polite"></p>
    </section>`;

  const form = el.querySelector(".newsletter__form");
  const input = el.querySelector("#newsletter-email");
  const message = el.querySelector(".newsletter__message");
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!emailRe.test(input.value.trim())) {
      message.textContent = n.errorMessage;
      message.className = "newsletter__message is-error";
      input.focus();
      return;
    }
    // UI only for now — no email provider connected yet.
    message.textContent = n.successMessage;
    message.className = "newsletter__message is-success";
    form.reset();
  });
}

/* ------------------------------ Footer ------------------------------ */
function mountFooter(site) {
  const el = document.getElementById("site-footer");
  if (!el) return;

  const columns = site.footerLinks
    .map(
      (col) => `
      <div class="footer-col">
        <h3>${escapeHtml(col.heading)}</h3>
        <ul>${col.links.map((l) => `<li><a href="${l.href}">${escapeHtml(l.label)}</a></li>`).join("")}</ul>
      </div>`
    )
    .join("");

  const socialLinks = site.social
    .map((s) => `<a href="${s.href}" aria-label="${escapeHtml(s.label)}"><img src="${s.icon}" alt=""></a>`)
    .join("");

  el.innerHTML = `
    <div class="footer-grid">
      <div class="footer-col footer-brand">
        <img src="${site.logos.wordmark}" alt="${escapeHtml(site.brand)}" class="footer-logo">
        <p>${escapeHtml(site.tagline)}</p>
        <div class="social-links">${socialLinks}</div>
      </div>
      ${columns}
    </div>
    <div class="footer-bottom">
      <p>&copy; ${new Date().getFullYear()} ${escapeHtml(site.brand)}. All rights reserved.</p>
    </div>`;
}

async function mountChrome() {
  document.addEventListener("cart:change", updateCartBadge);
  try {
    const site = await loadSite();
    mountAnnouncement(site.announcement);
    mountHeader(site);
    mountNewsletter(site.newsletter);
    mountFooter(site);
  } catch (err) {
    console.error("Failed to mount site chrome:", err);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountChrome);
} else {
  mountChrome();
}
