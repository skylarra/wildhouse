// Wildhouse Lane — content loader.
// Single access point for editable content stored as JSON under /content.
// Components and pages read from here so copy/images/announcements can change
// without touching code. Results are cached per path for the page session.

import { versionAssetUrlsInData } from "./collection-assets.js";

const cache = new Map();

/** Site-root URL so /admin/* and pretty routes still resolve content/api/data. */
export function sitePath(path = "") {
  const clean = String(path).replace(/^\.\//, "").replace(/^\//, "");
  return `/${clean}`;
}

export async function loadJSON(path) {
  const url = path.startsWith("http") || path.startsWith("/") ? path : sitePath(path);
  if (cache.has(url)) return cache.get(url);
  const promise = fetch(url, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load content: ${url} (${res.status})`);
      return res.json();
    })
    // Content-hash local /assets paths so footer/hero/studio images bust caches.
    .then((data) => versionAssetUrlsInData(data));
  cache.set(url, promise);
  return promise;
}

export function loadSite() {
  return loadJSON("content/site.json");
}

export function loadPage(name) {
  return loadJSON(`content/pages/${name}.json`);
}
