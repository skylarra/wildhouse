// Wildhouse Lane — localStorage store.
// Namespaced so it can later migrate to user accounts without collisions.
// Holds: cart, favorites, recently-viewed, and dismissed UI preferences.

const NS = "wildhouseLane";
const KEYS = {
  cart: `${NS}:cart`,
  favorites: `${NS}:favorites`,
  recentlyViewed: `${NS}:recentlyViewed`,
  prefs: `${NS}:prefs`,
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.warn("store: failed to read", key, err);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("store: failed to write", key, err);
  }
}

// Let any part of the UI react to changes (cart badge, favorite hearts, etc.).
function emit(name, detail) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

/* ----------------------------- Cart ----------------------------- */
// A cart line: { variationId, itemId, name, variationName, priceCents, image, handle, qty }

export function getCart() {
  return read(KEYS.cart, []);
}

export function cartCount() {
  return getCart().reduce((sum, line) => sum + line.qty, 0);
}

export function cartSubtotalCents() {
  return getCart().reduce((sum, line) => sum + line.priceCents * line.qty, 0);
}

export function addToCart(line, qty = 1) {
  const cart = getCart();
  const existing = cart.find((l) => l.variationId === line.variationId);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ ...line, qty });
  }
  write(KEYS.cart, cart);
  emit("cart:change", { cart });
  return cart;
}

export function setQty(variationId, qty) {
  let cart = getCart();
  if (qty <= 0) {
    cart = cart.filter((l) => l.variationId !== variationId);
  } else {
    const line = cart.find((l) => l.variationId === variationId);
    if (line) line.qty = qty;
  }
  write(KEYS.cart, cart);
  emit("cart:change", { cart });
  return cart;
}

export function removeFromCart(variationId) {
  return setQty(variationId, 0);
}

export function clearCart() {
  write(KEYS.cart, []);
  emit("cart:change", { cart: [] });
}

/* --------------------------- Favorites --------------------------- */

export function getFavorites() {
  return read(KEYS.favorites, []);
}

export function isFavorite(itemId) {
  return getFavorites().includes(itemId);
}

export function toggleFavorite(itemId) {
  const favs = getFavorites();
  const idx = favs.indexOf(itemId);
  if (idx === -1) favs.push(itemId);
  else favs.splice(idx, 1);
  write(KEYS.favorites, favs);
  emit("favorites:change", { favorites: favs });
  return favs;
}

/* ------------------------ Recently viewed ------------------------ */

export function getRecentlyViewed() {
  return read(KEYS.recentlyViewed, []);
}

export function pushRecentlyViewed(itemId, max = 8) {
  let list = getRecentlyViewed().filter((id) => id !== itemId);
  list.unshift(itemId);
  list = list.slice(0, max);
  write(KEYS.recentlyViewed, list);
  emit("recentlyViewed:change", { recentlyViewed: list });
  return list;
}

/* ------------------------- UI preferences ------------------------ */

export function getPref(name, fallback = null) {
  const prefs = read(KEYS.prefs, {});
  return name in prefs ? prefs[name] : fallback;
}

export function setPref(name, value) {
  const prefs = read(KEYS.prefs, {});
  prefs[name] = value;
  write(KEYS.prefs, prefs);
  return prefs;
}
