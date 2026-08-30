// Contact page — email + social channels (no form for launch).
import { renderContentPage } from "./page.js";
import { escapeHtml } from "./ui.js";

function channelsHTML(channels) {
  if (!channels?.length) return "";
  return `
    <ul class="contact-channels">
      ${channels
        .map(
          (c) => `
        <li class="contact-channels__item">
          <span class="contact-channels__label">${escapeHtml(c.label)}</span>
          <a class="contact-channels__link" href="${escapeHtml(c.href)}"${
            c.href.startsWith("http") ? ' target="_blank" rel="noopener noreferrer"' : ""
          }>${escapeHtml(c.value)}</a>
        </li>`
        )
        .join("")}
    </ul>`;
}

async function init() {
  const content = document.getElementById("contact-content");
  if (!content) return;

  const page = await renderContentPage(content);
  if (page?.channels?.length) {
    content.insertAdjacentHTML("beforeend", channelsHTML(page.channels));
  }
}

init();
