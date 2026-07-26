// Wildhouse Lane — content loader.
// Single access point for editable content stored as JSON under /content.
// Components and pages read from here so copy/images/announcements can change
// without touching code. Results are cached per path for the page session.

const cache = new Map();

export async function loadJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = fetch(path, { cache: "no-store" }).then((res) => {
    if (!res.ok) throw new Error(`Failed to load content: ${path} (${res.status})`);
    return res.json();
  });
  cache.set(path, promise);
  return promise;
}

export function loadSite() {
  return loadJSON("./content/site.json");
}

export function loadPage(name) {
  return loadJSON(`./content/pages/${name}.json`);
}
