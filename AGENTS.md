# Wildhouse Market

Wildhouse Lane is a handcrafted ecommerce platform built with semantic HTML, modular CSS, and modern vanilla JavaScript. Square is the source of truth for products, pricing, inventory, orders, and payments. The website focuses on immersive storytelling, nature-inspired artwork, and premium user experience while remaining lightweight and maintainable.

## Structure

- `index.html` — landing page (Cloudflare Pages / static hosting entry point).
- `shop.html` — shop listing page.
- `admin/*.html` — static admin mockup pages (dashboard, products, orders, media).
- `styles.css` — single global stylesheet shared by all pages.
- `assets/` — images and SVG logos.
- `robots.txt`, `sitemap.xml` — SEO files.

## Cursor Cloud specific instructions

- This is a fully static site. There are no dependencies to install, no lint/test/build tooling, and no backend. The update script is intentionally a no-op verification.
- Run it by serving the repository root over HTTP. Example: `python3 -m http.server 8000` and visit `http://localhost:8000/` or `http://localhost:8000/index.html`.
- Open files via the HTTP server rather than `file://` so relative asset paths and Google Fonts resolve correctly.
