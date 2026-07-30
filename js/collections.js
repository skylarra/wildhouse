// Collections index — one card per Square category that has products.
// Names, covers, counts, and storytelling copy come from catalog + content/collections.json.
import { getCollections } from "./catalog.js";
import { collectionCardHTML } from "./ui.js";

async function init() {
  const grid = document.getElementById("collections-grid");
  if (!grid) return;
  try {
    const collections = await getCollections();
    if (!collections.length) {
      grid.innerHTML = `<p class="empty">Collections will appear here once products are assigned to Square categories.</p>`;
      return;
    }
    grid.innerHTML = collections.map(collectionCardHTML).join("");
  } catch (err) {
    grid.innerHTML = `<p class="error">Could not load collections right now.</p>`;
    console.error(err);
  }
}

init();
