// Wildhouse Lane — reusable layout components.
// Renders the announcement bar, header/nav, footer, and newsletter into the
// placeholder containers present on every page, then wires their behavior.
// Content comes from js/config.js so there is a single place to edit.

import { site, announcement, nav, footerLinks, social } from "./config.js";
import { cartCount, getPref, setPref } from "./store.js";

const currentFile = location.pathname.split("/").pop() || "index.html";

function isActive(href) {
  const file = href.split("/").pop();
  return file === currentFile || (currentFile === "" && file === "index.html");
}

/* ------------------------- Announcement bar ------------------------- */
function mountAnnouncement() {
  const el = document.getElementById("site-announcement");
  if (!el || !announcement.messages.length) return;

  if (announcement.dismissible && getPref("announcementDismissed") === true) {
    el.hidden = true;
    return;
  }

  el.innerHTML = `
    <div class="announcement" role="region" aria-label="Announcements">
      <p class="announcement__text" aria-live="polite">${announcement.messages[0]}</p>
      ${announcement.dismissible ? '<button class="announcement__close" type="button" aria-label="Dismiss announcement">&times;</button>' : ""}
    </div>`;

  const textEl = el.querySelector(".announcement__text");
  let i = 0;
  if (announcement.messages.length > 1) {
    setInterval(() => {
      i = (i + 1) % announcement.messages.length;
      textEl.textContent = announcement.messages[i];
    }, announcement.rotateMs);
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
function mountHeader() {
  const el = document.getElementById("site-header");
  if (!el) return;

  const links = nav
    .map(
      (item) =>
        `<a href="${item.href}"${isActive(item.href) ? ' aria-current="page"' : ""}>${item.label}</a>`
    )
    .join("");

  el.innerHTML = `
    <nav class="nav" aria-label="Primary">
      <a href="./index.html" class="nav-brand" aria-label="${site.brand} home">
        <img src="./assets/WILDHOUSE-submark.svg" class="nav-logo" alt="${site.brand}">
      </a>
      <div class="nav-links" id="navLinks">${links}</div>
      <div class="nav-actions">
        <a class="nav-cart" href="./cart.html" aria-label="Cart">
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
    const isOpen = navLinks.classList.toggle("active");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("active");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });

  updateCartBadge();
}

export function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  if (!badge) return;
  const count = cartCount();
  badge.textContent = String(count);
  badge.hidden = count === 0;
}

/* ---------------------------- Newsletter ---------------------------- */
function mountNewsletter() {
  const el = document.getElementById("site-newsletter");
  if (!el) return;

  el.innerHTML = `
    <section class="newsletter" aria-labelledby="newsletter-heading">
      <h2 id="newsletter-heading" class="shadows-into-light-regular">Join the Club</h2>
      <p>Be first to know about new collections, restocks, and vendor events.</p>
      <form class="newsletter__form" novalidate>
        <label class="visually-hidden" for="newsletter-email">Email address</label>
        <input type="email" id="newsletter-email" name="email" placeholder="you@example.com" autocomplete="email" required>
        <button type="submit" class="btn secondary">Sign Up</button>
      </form>
      <p class="newsletter__message" role="status" aria-live="polite"></p>
    </section>`;

  const form = el.querySelector(".newsletter__form");
  const input = el.querySelector("#newsletter-email");
  const message = el.querySelector(".newsletter__message");
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!emailRe.test(value)) {
      message.textContent = "Please enter a valid email address.";
      message.className = "newsletter__message is-error";
      input.focus();
      return;
    }
    // UI only for now — no email provider connected yet.
    message.textContent = "Thanks for joining! Check your inbox soon.";
    message.className = "newsletter__message is-success";
    form.reset();
  });
}

/* ------------------------------ Footer ------------------------------ */
function mountFooter() {
  const el = document.getElementById("site-footer");
  if (!el) return;

  const columns = footerLinks
    .map(
      (col) => `
      <div class="footer-col">
        <h3>${col.heading}</h3>
        <ul>${col.links.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join("")}</ul>
      </div>`
    )
    .join("");

  const socialLinks = social
    .map(
      (s) => `<a href="${s.href}" aria-label="${s.label}"><img src="${s.icon}" alt=""></a>`
    )
    .join("");

  el.innerHTML = `
    <div class="footer-grid">
      <div class="footer-col footer-brand">
        <img src="./assets/WILDHOUSE-WordMark.svg" alt="${site.brand}" class="footer-logo">
        <p>${site.tagline}</p>
        <div class="social-links">${socialLinks}</div>
      </div>
      ${columns}
    </div>
    <div class="footer-bottom">
      <p>&copy; ${new Date().getFullYear()} ${site.brand}. All rights reserved.</p>
    </div>`;
}

function mountChrome() {
  mountAnnouncement();
  mountHeader();
  mountNewsletter();
  mountFooter();
  document.addEventListener("cart:change", updateCartBadge);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountChrome);
} else {
  mountChrome();
}
