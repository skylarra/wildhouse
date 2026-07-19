// Contact page — client-side validation with a success message.
// UI only for now; wire to a provider/endpoint before launch.
const form = document.getElementById("contact-form");
if (form) {
  const message = form.querySelector(".form-message");
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = form.querySelector("#contact-name").value.trim();
    const email = form.querySelector("#contact-email").value.trim();
    const body = form.querySelector("#contact-message").value.trim();

    if (!name || !body || !emailRe.test(email)) {
      message.textContent = "Please fill in your name, a valid email, and a message.";
      message.className = "form-message is-error";
      return;
    }
    message.textContent = "Thanks! Your message has been received.";
    message.className = "form-message is-success";
    form.reset();
  });
}
