// Collections index — one card per Square category that has products.
// Names, covers, counts, and storytelling copy come from catalog + content/collections.json.
import { getCollections } from "./catalog.js";
import { collectionCardHTML, wireImagePlaceholders } from "./ui.js";

function emptyStateHTML({ title, body, primary, secondary }) {
  const second = secondary
    ? `<a class="btn" href="${secondary.href}">${secondary.label}</a>`
    : "";
  return `
    <div class="empty-state">
      <h2 class="empty-state__title">${title}</h2>
      <p class="empty-state__body">${body}</p>
      <div class="empty-state__actions">
        <a class="btn secondary" href="${primary.href}">${primary.label}</a>
        ${second}
      </div>
    </div>`;
}

function skeletonGridHTML(count = 6) {
  return `<div class="skeleton-grid" aria-hidden="true">${Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton-card__media"></div>
      <div class="skeleton-card__line"></div>
      <div class="skeleton-card__line skeleton-card__line--short"></div>
    </div>`).join("")}</div>`;
}

async function init() {
  const grid = document.getElementById("collections-grid");
  if (!grid) return;
  grid.innerHTML = skeletonGridHTML(6);
  try {
    const collections = await getCollections();
    if (!collections.length) {
      grid.innerHTML = emptyStateHTML({
        title: "Collections coming soon",
        body: "Once products are grouped into categories, they’ll show up here. In the meantime, browse the full shop.",
        primary: { href: "./shop.html", label: "Shop all products" },
        secondary: { href: "./index.html", label: "Back to home" },
      });
      return;
    }
    grid.innerHTML = collections.map(collectionCardHTML).join("");
    wireImagePlaceholders(grid);
  } catch (err) {
    grid.innerHTML = emptyStateHTML({
      title: "Couldn’t load collections",
      body: "Please try again shortly, or head to the shop while we sort this out.",
      primary: { href: "./shop.html", label: "Shop all products" },
      secondary: { href: "./contact.html", label: "Contact us" },
    });
    console.error(err);
  }
}

init();
