// Admin · Products — read-only Square merchandising inspector.
// Featured + Collection membership are edited in Square, not here.
import { getProducts } from "./catalog.js";
import { escapeHtml } from "./ui.js";

const listEl = document.getElementById("admin-products-list");
const statusEl = document.getElementById("admin-products-status");
const filterEl = document.getElementById("admin-products-filter");
const featuredEl = document.getElementById("admin-products-featured");

/** @type {Awaited<ReturnType<typeof getProducts>>} */
let products = [];

function setStatus(msg, kind = "") {
  if (!statusEl) return;
  statusEl.textContent = msg || "";
  statusEl.className = `admin-status${kind ? ` is-${kind}` : ""}`;
}

function filtered() {
  const term = (filterEl?.value || "").trim().toLowerCase();
  const feat = featuredEl?.value || "all";
  return products.filter((p) => {
    if (feat === "yes" && !p.featured) return false;
    if (feat === "no" && p.featured) return false;
    if (!term) return true;
    const hay = [
      p.name,
      p.handle,
      p.categoryName,
      p.collectionName,
      ...(p.collectionNames || []),
      ...(p.tags || []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(term);
  });
}

function render() {
  if (!listEl) return;
  const rows = filtered();
  if (!rows.length) {
    listEl.innerHTML = `<p class="empty-state__body">No products match.</p>`;
    return;
  }

  listEl.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th scope="col">Product</th>
          <th scope="col">Featured</th>
          <th scope="col">Collection(s)</th>
          <th scope="col">Type</th>
          <th scope="col">Stock</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((p) => {
            const collections =
              (p.collectionNames || []).length > 0
                ? (p.collectionNames || []).map((n) => escapeHtml(n)).join(", ")
                : "<span class=\"admin-muted\">—</span>";
            return `
          <tr>
            <td>
              <a href="../product.html?handle=${encodeURIComponent(p.handle)}">${escapeHtml(p.name)}</a>
              <div class="admin-muted"><code>${escapeHtml(p.handle)}</code></div>
            </td>
            <td>${
              p.featured
                ? '<span class="admin-pill admin-pill--on">Yes</span>'
                : '<span class="admin-pill">No</span>'
            }</td>
            <td>${collections}</td>
            <td>${escapeHtml(p.categoryName || "—")}</td>
            <td>${p.inStock ? p.totalStock : "Sold out"}</td>
          </tr>`;
          })
          .join("")}
      </tbody>
    </table>`;
}

async function load() {
  setStatus("Loading products…");
  try {
    products = await getProducts();
    products.sort((a, b) => a.name.localeCompare(b.name));
    const featuredCount = products.filter((p) => p.featured).length;
    setStatus(
      `${products.length} products · ${featuredCount} featured (from Square). Edit Featured / Collection in Square.`,
      "ok"
    );
    render();
  } catch (err) {
    setStatus("Could not load catalog.", "error");
    listEl.innerHTML = `<p class="error">Could not load products.</p>`;
    console.error(err);
  }
}

function init() {
  filterEl?.addEventListener("input", () => render());
  featuredEl?.addEventListener("change", () => render());
  document.getElementById("admin-products-reload")?.addEventListener("click", () => load());
  load();
}

init();
