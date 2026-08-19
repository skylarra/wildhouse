// Contact page — channels + mailto draft form for launch.
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
  const mount = document.getElementById("contact-form-mount");
  if (!content || !mount) return;

  const page = await renderContentPage(content);
  if (page?.channels?.length) {
    content.insertAdjacentHTML("beforeend", channelsHTML(page.channels));
  }

  const form = page?.form;
  if (!form) return;
  const f = form.fields;

  mount.innerHTML = `
    <section class="contact-form-section" aria-labelledby="contact-form-heading">
      <h2 id="contact-form-heading">${escapeHtml(form.heading || "Send a note")}</h2>
      <form class="contact-form" id="contact-form" novalidate>
        <label class="field">
          <span>${escapeHtml(f.name)}</span>
          <input type="text" name="name" id="contact-name" required autocomplete="name">
        </label>
        <label class="field">
          <span>${escapeHtml(f.email)}</span>
          <input type="email" name="email" id="contact-email" required autocomplete="email">
        </label>
        <label class="field">
          <span>${escapeHtml(f.message)}</span>
          <textarea name="message" id="contact-message" rows="5" required></textarea>
        </label>
        <button type="submit" class="btn secondary" id="contact-submit">${escapeHtml(f.submit)}</button>
        <p class="form-message" role="status" aria-live="polite"></p>
      </form>
    </section>`;

  const formEl = mount.querySelector("#contact-form");
  const message = mount.querySelector(".form-message");
  const submitBtn = mount.querySelector("#contact-submit");
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = formEl.querySelector("#contact-name").value.trim();
    const email = formEl.querySelector("#contact-email").value.trim();
    const body = formEl.querySelector("#contact-message").value.trim();
    if (!name || !body || !emailRe.test(email)) {
      message.textContent = form.errorMessage;
      message.className = "form-message is-error";
      return;
    }

    submitBtn.classList.add("is-loading");
    submitBtn.disabled = true;

    const subject = encodeURIComponent(`Wildhouse Lane message from ${name}`);
    const mailBody = encodeURIComponent(
      `${body}\n\n—\nFrom: ${name}\nReply-to: ${email}`
    );
    window.location.href = `mailto:skylar@wildhouselane.com?subject=${subject}&body=${mailBody}`;

    message.textContent = form.successMessage;
    message.className = "form-message is-success";
    window.setTimeout(() => {
      submitBtn.classList.remove("is-loading");
      submitBtn.disabled = false;
    }, 600);
  });
}

init();
