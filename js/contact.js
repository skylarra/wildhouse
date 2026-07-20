// Contact page — renders intro content and a content-driven form.
// UI only for now; wire to a provider/endpoint before launch.
import { renderContentPage } from "./page.js";
import { escapeHtml } from "./ui.js";

async function init() {
  const content = document.getElementById("contact-content");
  const mount = document.getElementById("contact-form-mount");
  if (!content || !mount) return;

  const page = await renderContentPage(content);
  const form = page?.form;
  if (!form) return;
  const f = form.fields;

  mount.innerHTML = `
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
      <button type="submit" class="btn secondary">${escapeHtml(f.submit)}</button>
      <p class="form-message" role="status" aria-live="polite"></p>
    </form>`;

  const formEl = mount.querySelector("#contact-form");
  const message = mount.querySelector(".form-message");
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
    message.textContent = form.successMessage;
    message.className = "form-message is-success";
    formEl.reset();
  });
}

init();
