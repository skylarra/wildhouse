// Wildhouse Lane — site configuration.
// This is the ONE file to edit for brand text, the announcement bar, navigation,
// footer links, and social links. Reusable components read from here.

export const site = {
  brand: "Wildhouse Lane",
  tagline: "Handmade goods for people who love spooky nature art.",
  // Domain is not purchased yet; used for canonical/SEO once live.
  domain: "https://wildhouselane.com",
  email: "hello@wildhouselane.com",
  freeShippingThresholdCents: 7500,
};

// Announcement bar messages. Add/remove/edit strings here.
// Multiple messages rotate automatically. Set `dismissible` to false to force-show.
export const announcement = {
  dismissible: true,
  rotateMs: 4500,
  messages: [
    "Free shipping on orders over $75",
    "New Collection Available",
    "Vendor Event This Weekend",
  ],
};

// Primary navigation (adopted fuller nav + page set).
export const nav = [
  { label: "SHOP", href: "./shop.html" },
  { label: "COLLECTIONS", href: "./collections.html" },
  { label: "ABOUT", href: "./about.html" },
  { label: "CONTACT", href: "./contact.html" },
  { label: "FAQs", href: "./faqs.html" },
];

export const footerLinks = [
  {
    heading: "Shop",
    links: [
      { label: "All Products", href: "./shop.html" },
      { label: "Collections", href: "./collections.html" },
      { label: "Events", href: "./events.html" },
    ],
  },
  {
    heading: "About",
    links: [
      { label: "Our Story", href: "./about.html" },
      { label: "Contact", href: "./contact.html" },
      { label: "FAQs", href: "./faqs.html" },
    ],
  },
  {
    heading: "Info",
    links: [
      { label: "Shipping & Policies", href: "./policies.html" },
    ],
  },
];

export const social = [
  { label: "Instagram @wildhousemkt", href: "https://www.instagram.com/wildhousemkt/", icon: "./assets/social1.svg" },
  { label: "TikTok @wildhousemarket", href: "https://www.tiktok.com/@wildhousemarket", icon: "./assets/social2.svg" },
];
