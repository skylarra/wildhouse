// Custom Orders page — immersive maker portfolio + mailto inquiry.
// Content: content/custom-orders.json (gallery images marked with _todo).
import { loadJSON } from "./content.js";
import { escapeHtml, wireImagePlaceholders } from "./ui.js";

const root = document.getElementById("custom-orders-root");

function ctaHTML(cta, cls = "btn secondary") {
  if (!cta) return "";
  return `<a class="${cls}" href="${escapeHtml(cta.href)}">${escapeHtml(cta.label)}</a>`;
}

function renderHero(hero) {
  if (!hero) return "";
  return `
    <section class="custom-hero" aria-labelledby="custom-hero-heading">
      <div class="custom-hero__inner page-wrap">
        <div class="custom-hero__copy">
          <h1 id="custom-hero-heading" class="custom-hero__heading homemade-apple-regular">${escapeHtml(hero.heading || "Custom Orders")}</h1>
          ${hero.tagline ? `<p class="custom-hero__tagline">${escapeHtml(hero.tagline)}</p>` : ""}
          <p class="custom-hero__body">${escapeHtml(hero.body || "")}</p>
          <div class="custom-hero__actions">${ctaHTML(hero.cta, "btn secondary")}</div>
        </div>
        ${
          hero.image
            ? `<div class="custom-hero__media img-placeholder" aria-hidden="false">
                <img src="${escapeHtml(hero.image.src)}" alt="${escapeHtml(hero.image.alt || "")}" fetchpriority="high" data-fallback="./assets/coming-soon.png">
              </div>`
            : ""
        }
      </div>
    </section>`;
}

function renderGallery(gallery) {
  if (!gallery?.items?.length) return "";
  const frames = ["is-tilt-a", "is-tilt-b", "is-tilt-c", "is-tilt-d"];
  const cards = gallery.items
    .map((item, i) => {
      const frame = frames[i % frames.length];
      const label = item.category || item.title || "";
      return `
        <li class="custom-roll__item">
          <button type="button" class="custom-roll__card ${frame}" data-lightbox-index="${i}" aria-label="${escapeHtml(label || "View custom piece")}">
            <span class="custom-roll__frame">
              <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt || label)}" loading="lazy" data-fallback="./assets/coming-soon.png">
            </span>
            ${label ? `<span class="custom-roll__caption">${escapeHtml(label)}</span>` : ""}
          </button>
        </li>`;
    })
    .join("");

  return `
    <section class="custom-roll" aria-labelledby="custom-roll-heading">
      <div class="custom-roll__intro page-wrap">
        <h2 id="custom-roll-heading">${escapeHtml(gallery.heading || "")}</h2>
        ${gallery.body ? `<p>${escapeHtml(gallery.body)}</p>` : ""}
      </div>
      <div class="custom-roll__scroller" tabindex="0" role="region" aria-label="Custom project camera roll">
        <ul class="custom-roll__track">${cards}</ul>
      </div>
    </section>`;
}

function renderCategories(categories) {
  if (!categories?.items?.length) return "";
  return `
    <section class="custom-cats page-wrap" aria-labelledby="custom-cats-heading">
      <h2 id="custom-cats-heading">${escapeHtml(categories.heading || "")}</h2>
      ${categories.body ? `<p class="custom-section-lead">${escapeHtml(categories.body)}</p>` : ""}
      <ul class="custom-cats__grid">
        ${categories.items
          .map(
            (c) => `
          <li class="custom-cats__card${c.featured ? " is-open" : ""}">
            <h3>${escapeHtml(c.title)}</h3>
            <p>${escapeHtml(c.body)}</p>
          </li>`
          )
          .join("")}
      </ul>
    </section>`;
}

function renderProcess(process) {
  if (!process?.steps?.length) return "";
  return `
    <section class="custom-process" aria-labelledby="custom-process-heading">
      <div class="page-wrap">
        <h2 id="custom-process-heading">${escapeHtml(process.heading || "")}</h2>
        <ol class="custom-process__list">
          ${process.steps
            .map(
              (s) => `
            <li class="custom-process__step">
              <span class="custom-process__num" aria-hidden="true">${escapeHtml(s.number)}</span>
              <div>
                <h3>${escapeHtml(s.title)}</h3>
                <p>${escapeHtml(s.body)}</p>
              </div>
            </li>`
            )
            .join("")}
        </ol>
      </div>
    </section>`;
}

function renderFaq(faq) {
  if (!faq?.items?.length) return "";
  return `
    <aside class="custom-faq" aria-labelledby="custom-faq-heading">
      <h2 id="custom-faq-heading">${escapeHtml(faq.heading || "")}</h2>
      <div class="custom-faq__list">
        ${faq.items
          .map(
            (item, i) => `
          <details class="custom-faq__item"${i === 0 ? " open" : ""}>
            <summary>${escapeHtml(item.q)}</summary>
            <p>${escapeHtml(item.a)}</p>
          </details>`
          )
          .join("")}
      </div>
    </aside>`;
}

function renderForm(form) {
  if (!form) return "";
  const sources = (form.sourceOptions || [])
    .map((opt) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`)
    .join("");

  return `
    <section class="custom-inquiry" id="${escapeHtml(form.id || "custom-inquiry")}" aria-labelledby="custom-form-heading">
      <h2 id="custom-form-heading">${escapeHtml(form.heading || "")}</h2>
      ${form.intro ? `<p class="custom-section-lead">${escapeHtml(form.intro)}</p>` : ""}
      <form class="custom-form" id="custom-order-form" novalidate>
        <fieldset class="custom-form__fieldset">
          <legend>Contact</legend>
          <label class="field">
            <span>Name</span>
            <input type="text" name="name" id="co-name" required autocomplete="name">
          </label>
          <label class="field">
            <span>Email</span>
            <input type="email" name="email" id="co-email" required autocomplete="email">
          </label>
        </fieldset>

        <fieldset class="custom-form__fieldset">
          <legend>Project</legend>
          <label class="field">
            <span>What are you wanting made?</span>
            <input type="text" name="wanting" id="co-wanting" required>
          </label>
          <div class="custom-form__row">
            <label class="field">
              <span>Quantity</span>
              <input type="text" name="quantity" id="co-quantity" inputmode="numeric">
            </label>
            <label class="field">
              <span>Approximate size</span>
              <input type="text" name="size" id="co-size" placeholder="e.g. 8 × 10 in">
            </label>
          </div>
          <div class="custom-form__row">
            <label class="field">
              <span>Desired date</span>
              <input type="text" name="desiredDate" id="co-date" placeholder="Month / occasion">
            </label>
            <label class="field">
              <span>Budget range</span>
              <input type="text" name="budget" id="co-budget" placeholder="e.g. $40–$80">
            </label>
          </div>
        </fieldset>

        <fieldset class="custom-form__fieldset">
          <legend>Design</legend>
          <label class="field">
            <span>Tell me about your idea</span>
            <textarea name="idea" id="co-idea" rows="5" required></textarea>
          </label>
          <label class="field">
            <span>Preferred colors / materials</span>
            <input type="text" name="materials" id="co-materials">
          </label>
          <label class="field">
            <span>Is there text that needs to be included?</span>
            <input type="text" name="textInclude" id="co-text">
          </label>
          <label class="field">
            <span>Inspiration / reference notes</span>
            <textarea name="inspiration" id="co-inspiration" rows="3" placeholder="Links, vibes, sketches…"></textarea>
          </label>
          <p class="custom-form__note">${escapeHtml(form.uploadNote || "")}</p>
        </fieldset>

        <fieldset class="custom-form__fieldset">
          <legend>A little more</legend>
          <label class="field">
            <span>How did you find Wildhouse Lane?</span>
            <select name="source" id="co-source">
              <option value="">Select one</option>
              ${sources}
            </select>
          </label>
          <label class="custom-form__check">
            <input type="checkbox" name="disclaimer" id="co-disclaimer" required>
            <span>${escapeHtml(form.disclaimer || "")}</span>
          </label>
        </fieldset>

        <button type="submit" class="btn secondary" id="co-submit">${escapeHtml(form.submitLabel || "Send custom request")}</button>
        <p class="form-message" id="co-message" role="status" aria-live="polite"></p>
      </form>
      <div class="custom-form__success" id="co-success" hidden>
        <h3>Thank you — your idea is on its way</h3>
        <p id="co-success-body"></p>
        <a class="btn" href="./shop.html">Browse the shop while you wait</a>
      </div>
    </section>`;
}

function renderInquiryBand(form, faq) {
  return `
    <div class="custom-inquiry-band">
      <div class="custom-inquiry-band__inner page-wrap">
        ${renderForm(form)}
        ${renderFaq(faq)}
      </div>
    </div>`;
}

function openLightbox(items, index) {
  const item = items[index];
  if (!item) return;
  let overlay = document.getElementById("custom-lightbox");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "custom-lightbox";
    overlay.className = "custom-lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Custom piece preview");
    overlay.innerHTML = `
      <button type="button" class="custom-lightbox__close" aria-label="Close">&times;</button>
      <figure class="custom-lightbox__figure">
        <img alt="">
        <figcaption></figcaption>
      </figure>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || e.target.closest(".custom-lightbox__close")) closeLightbox();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeLightbox();
    });
  }
  const img = overlay.querySelector("img");
  const cap = overlay.querySelector("figcaption");
  img.src = item.image;
  img.alt = item.alt || item.category || item.title || "";
  cap.textContent = item.category || item.title || "";
  overlay.hidden = false;
  document.body.classList.add("has-lightbox");
  overlay.querySelector(".custom-lightbox__close").focus();
}

function closeLightbox() {
  const overlay = document.getElementById("custom-lightbox");
  if (!overlay) return;
  overlay.hidden = true;
  document.body.classList.remove("has-lightbox");
}

function wireGallery(gallery) {
  const scroller = root.querySelector(".custom-roll__scroller");
  if (scroller) {
    scroller.addEventListener(
      "wheel",
      (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          scroller.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      },
      { passive: false }
    );
  }
  root.querySelectorAll("[data-lightbox-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openLightbox(gallery.items, Number(btn.dataset.lightboxIndex));
    });
  });
}

function wireForm(form) {
  const formEl = document.getElementById("custom-order-form");
  const message = document.getElementById("co-message");
  const submitBtn = document.getElementById("co-submit");
  const success = document.getElementById("co-success");
  const successBody = document.getElementById("co-success-body");
  if (!formEl) return;

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const to = form.mailto || "skylar@wildhouselane.com";

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = formEl.querySelector("#co-name").value.trim();
    const email = formEl.querySelector("#co-email").value.trim();
    const wanting = formEl.querySelector("#co-wanting").value.trim();
    const idea = formEl.querySelector("#co-idea").value.trim();
    const disclaimer = formEl.querySelector("#co-disclaimer").checked;

    if (!name || !wanting || !idea || !emailRe.test(email) || !disclaimer) {
      message.textContent = form.errorMessage;
      message.className = "form-message is-error";
      return;
    }

    const quantity = formEl.querySelector("#co-quantity").value.trim();
    const size = formEl.querySelector("#co-size").value.trim();
    const desiredDate = formEl.querySelector("#co-date").value.trim();
    const budget = formEl.querySelector("#co-budget").value.trim();
    const materials = formEl.querySelector("#co-materials").value.trim();
    const textInclude = formEl.querySelector("#co-text").value.trim();
    const inspiration = formEl.querySelector("#co-inspiration").value.trim();
    const source = formEl.querySelector("#co-source").value.trim();

    submitBtn.classList.add("is-loading");
    submitBtn.disabled = true;

    const subject = encodeURIComponent(`Custom order inquiry from ${name}`);
    const body = encodeURIComponent(
      [
        `Name: ${name}`,
        `Email: ${email}`,
        `Wanting made: ${wanting}`,
        `Quantity: ${quantity || "—"}`,
        `Size: ${size || "—"}`,
        `Desired date: ${desiredDate || "—"}`,
        `Budget: ${budget || "—"}`,
        "",
        "Idea:",
        idea,
        "",
        `Colors / materials: ${materials || "—"}`,
        `Text to include: ${textInclude || "—"}`,
        `Inspiration notes: ${inspiration || "—"}`,
        `Found via: ${source || "—"}`,
        "",
        "(Attach reference photos to this email if you have them.)",
      ].join("\n")
    );

    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;

    formEl.hidden = true;
    success.hidden = false;
    successBody.textContent = form.successMessage;
    message.textContent = "";
    window.setTimeout(() => {
      submitBtn.classList.remove("is-loading");
      submitBtn.disabled = false;
    }, 600);
  });
}

export async function initCustomOrdersPage() {
  if (!root) return;
  let data;
  try {
    data = await loadJSON("./content/custom-orders.json");
  } catch (err) {
    root.innerHTML = `<p class="error page-wrap">Could not load the custom orders page.</p>`;
    console.error(err);
    return;
  }

  if (data.seo?.title) document.title = data.seo.title;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && data.seo?.description) metaDesc.setAttribute("content", data.seo.description);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle && data.seo?.title) ogTitle.setAttribute("content", data.seo.title);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc && data.seo?.description) ogDesc.setAttribute("content", data.seo.description);

  root.innerHTML = [
    renderHero(data.hero),
    renderGallery(data.gallery),
    renderCategories(data.categories),
    renderProcess(data.process),
    renderInquiryBand(data.form, data.faq),
  ].join("\n");

  wireImagePlaceholders(root);
  wireGallery(data.gallery || { items: [] });
  wireForm(data.form);
}

initCustomOrdersPage();
