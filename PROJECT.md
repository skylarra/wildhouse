# Wildhouse Lane

## Vision

Wildhouse Lane is a handcrafted ecommerce website and future creative platform centered around original artwork inspired by nature, folklore, astronomy, curiosity, and wonder.

The website should never feel like a generic Shopify storefront.

Visitors should feel like they discovered a hidden little nature shop tucked into the woods.

The experience should be immersive, calm, elegant, and magical.

---

# Current Technology

Frontend

- HTML5
- CSS3
- Modern Vanilla JavaScript (ES Modules)

Hosting

- Cloudflare Pages

Commerce

- Square

Version Control

- Git + GitHub

---

# Core Principles

The project values:

- simplicity
- maintainability
- accessibility
- performance
- responsive design
- reusable components
- semantic HTML

Never add frameworks unless explicitly approved.

No Bootstrap.

No jQuery.

No React.

No Astro.

No Tailwind.

---

# Architecture

The website should be built using reusable components.

Examples:

- Header
- Footer
- Navigation
- Product Cards
- Announcement Bar
- Newsletter
- Cart Drawer

Avoid duplicated HTML whenever possible.

---

# Data

Square is the source of truth for:

- products
- pricing
- inventory
- variants
- checkout
- orders

Until Square is connected:

Use products.json that mirrors Square's data model.

Do not hardcode products into HTML.

---

# Local Storage

Before customer accounts exist:

Store locally:

- Favorites
- Recently Viewed
- Shopping Cart
- UI Preferences

The storage layer should be abstracted so it can later migrate to customer accounts.

---

# Performance Goals

Fast.

Minimal JavaScript.

Lazy load images.

Responsive images.

Accessibility score above 95.

Lighthouse score above 95.

---

# Design Philosophy

The website should feel:

- handcrafted
- premium
- quiet
- earthy
- mysterious
- immersive

Avoid anything that feels corporate or template-driven.

Every animation should have purpose.

Less is more.

---

# Future Features (Not July Launch)

Customer accounts

Wishlists synced across devices

Astrology builder

Wholesale portal

Journal

Blog

Reviews

Digital downloads

Memberships

Loyalty rewards

Vendor event calendar

Custom laser personalization

---

# July 27 Launch Goal

A production-ready ecommerce website that includes:

- Homepage
- Shop
- Collections
- Product Pages
- Favorites
- Recently Viewed
- Persistent Cart
- Square Checkout
- Responsive Design
- SEO
- Accessibility