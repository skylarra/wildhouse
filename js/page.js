// Wildhouse Lane — generic content-page renderer.
// Renders an editable content page (content/pages/<name>.json) into a container.
// The page name comes from the container's data-page attribute, so About, FAQs,
// Events, Policies, and Contact all share one renderer and one content schema.
//
// Supported top-level keys: title, hero {src,alt}, intro (html), blocks [], events [].
// Supported block types: paragraph {html}, heading {text, level?}, image {src,alt},
// cta {label, href}, note {html}, faqs {items:[{q,a}]}, events {items?|source}.

import { loadPage } from "./content.js";
import { escapeHtml } from "./ui.js";

function eventsListHTML(events) {
  return `<ul class="events-list">${events
    .map((ev) => {
      const date = formatDate(ev.date);
      return `<li><strong>${escapeHtml(ev.name)}</strong> — ${escapeHtml(ev.location)}<br>${date}${ev.time ? ` · ${escapeHtml(ev.time)}` : ""}</li>`;
    })
    .join("")}</ul>`;
}

function faqsHTML(items) {
  return items
    .map(
      (f, i) =>
        `<details${i === 0 ? " open" : ""}><summary>${escapeHtml(f.q)}</summary><p>${f.a}</p></details>`
    )
    .join("");
}

function blockHTML(block, page) {
  switch (block.type) {
    case "paragraph":
      return `<p>${block.html}</p>`;
    case "heading":
      return `<h${block.level || 2}>${escapeHtml(block.text)}</h${block.level || 2}>`;
    case "image":
      return `<img class="prose-img" src="${block.src}" alt="${escapeHtml(block.alt || "")}" loading="lazy">`;
    case "cta":
      return `<a class="btn secondary" href="${block.href}">${escapeHtml(block.label)}</a>`;
    case "note":
      return `<p class="content-note"><em>${block.html}</em></p>`;
    case "faqs":
      return faqsHTML(block.items || []);
    case "events":
      return eventsListHTML(block.items || page.events || []);
    default:
      console.warn("Unknown content block type:", block.type);
      return "";
  }
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime())
    ? escapeHtml(iso)
    : d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

export async function renderContentPage(container) {
  const name = container.dataset.page;
  if (!name) return;
  let page;
  try {
    page = await loadPage(name);
  } catch (err) {
    container.innerHTML = `<p class="error">Could not load this page.</p>`;
    console.error(err);
    return;
  }

  const parts = [];
  if (page.title) parts.push(`<h1 class="page-title">${escapeHtml(page.title)}</h1>`);
  if (page.hero) parts.push(`<img class="prose-hero" src="${page.hero.src}" alt="${escapeHtml(page.hero.alt || "")}">`);
  if (page.intro) parts.push(`<p class="prose-intro">${page.intro}</p>`);
  if (Array.isArray(page.blocks)) parts.push(...page.blocks.map((b) => blockHTML(b, page)));
  // Pages whose primary content is an events list (events.json) render it after blocks.
  if (Array.isArray(page.events) && !page.blocks?.some((b) => b.type === "events")) {
    parts.push(eventsListHTML(page.events));
  }

  container.innerHTML = parts.join("\n");
  return page;
}

// Auto-render any element flagged with data-page (kept generic for reuse).
const target = document.querySelector("[data-page]");
if (target && !target.dataset.pageManual) {
  renderContentPage(target);
}
