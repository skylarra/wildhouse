# Wildhouse Market

Static marketing/shop website for "Wildhouse Market" (handmade nature-themed art). Plain HTML + CSS with a small amount of inline JavaScript; no build step, no package manager, no backend.

## Structure

- `home.html` — landing page (main entry point; there is no `index.html`).
- `shop.html` — shop listing page.
- `admin/*.html` — static admin mockup pages (dashboard, products, orders, media).
- `styles.css` — single global stylesheet shared by all pages.
- `assets/` — images and SVG logos.
- `robots.txt`, `sitemap.xml` — SEO files.

## Cursor Cloud specific instructions

- This is a fully static site. There are no dependencies to install, no lint/test/build tooling, and no backend. The update script is intentionally a no-op verification.
- Run it by serving the repository root over HTTP, then open a page explicitly (there is no `index.html`, so `/` returns a directory listing). Example: `python3 -m http.server 8000` and visit `http://localhost:8000/home.html`.
- Open files via the HTTP server rather than `file://` so relative asset paths and Google Fonts resolve correctly.
