// Resolve Square Catalog modifier lists attached to an ITEM.
// Supports LIST modifiers (selectable options) and TEXT modifiers (free text).

function asInt(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeModifierType(raw) {
  const t = String(raw || "LIST").trim().toUpperCase();
  return t === "TEXT" ? "TEXT" : "LIST";
}

/**
 * Index MODIFIER_LIST (+ nested/top-level MODIFIER) objects from a Catalog List.
 * @returns {Map<string, object>}
 */
export function buildModifierListIndex(objects = []) {
  const modifierById = new Map();
  const listById = new Map();

  for (const obj of objects) {
    if (!obj || obj.is_deleted) continue;
    if (obj.type === "MODIFIER") {
      modifierById.set(obj.id, obj);
    }
  }

  for (const obj of objects) {
    if (!obj || obj.is_deleted) continue;
    if (obj.type !== "MODIFIER_LIST") continue;
    const data = obj.modifier_list_data || {};
    const nested = Array.isArray(data.modifiers) ? data.modifiers : [];
    const options = [];

    for (const mod of nested) {
      const id = mod?.id;
      const full = (id && modifierById.get(id)) || mod;
      if (!full || full.is_deleted) continue;
      const md = full.modifier_data || {};
      options.push({
        id: full.id,
        name: String(md.name || "").trim() || "Option",
        priceCents: md.price_money?.amount || 0,
        currency: md.price_money?.currency || "USD",
        onByDefault: Boolean(md.on_by_default),
        ordinal: asInt(md.ordinal, options.length),
      });
    }

    // Flat MODIFIER objects that belong to this list (when not nested).
    if (!options.length) {
      for (const mod of modifierById.values()) {
        const md = mod.modifier_data || {};
        if (md.modifier_list_id && md.modifier_list_id === obj.id) {
          options.push({
            id: mod.id,
            name: String(md.name || "").trim() || "Option",
            priceCents: md.price_money?.amount || 0,
            currency: md.price_money?.currency || "USD",
            onByDefault: Boolean(md.on_by_default),
            ordinal: asInt(md.ordinal, options.length),
          });
        }
      }
    }

    options.sort((a, b) => a.ordinal - b.ordinal || a.name.localeCompare(b.name));

    listById.set(obj.id, {
      id: obj.id,
      name: String(data.name || "").trim() || "Options",
      modifierType: normalizeModifierType(data.modifier_type),
      maxTextLength: asInt(data.max_length, 0) || asInt(data.max_text_length, 0) || 0,
      textRequired: Boolean(data.text_required ?? data.required_text),
      minSelected: asInt(data.min_selected_modifiers, -1),
      maxSelected: asInt(data.max_selected_modifiers, -1),
      ordinal: asInt(data.ordinal, 0),
      options,
    });
  }

  return listById;
}

/**
 * Resolve enabled modifier lists for a Square Catalog ITEM.
 * Returns a storefront-friendly array (empty when none).
 */
export function resolveItemModifiers(item, listById) {
  const infos = item?.item_data?.modifier_list_info;
  if (!Array.isArray(infos) || !infos.length || !listById?.size) return [];

  const resolved = [];
  for (const info of infos) {
    if (!info || info.enabled === false) continue;
    const list = listById.get(info.modifier_list_id);
    if (!list) continue;

    const minSelected =
      info.min_selected_modifiers != null && Number(info.min_selected_modifiers) >= 0
        ? Number(info.min_selected_modifiers)
        : list.minSelected >= 0
          ? list.minSelected
          : 0;
    const maxSelected =
      info.max_selected_modifiers != null && Number(info.max_selected_modifiers) >= 0
        ? Number(info.max_selected_modifiers)
        : list.maxSelected >= 0
          ? list.maxSelected
          : 0;

    const isText = list.modifierType === "TEXT";
    const required = isText
      ? Boolean(list.textRequired) || minSelected > 0
      : minSelected > 0;

    // Apply per-item modifier overrides (on_by_default / sold out).
    let options = list.options.map((o) => ({ ...o }));
    const overrides = Array.isArray(info.modifier_overrides) ? info.modifier_overrides : [];
    if (overrides.length) {
      const byId = new Map(overrides.map((o) => [o.modifier_id, o]));
      options = options
        .map((o) => {
          const ov = byId.get(o.id);
          if (!ov) return o;
          if (ov.on_by_default != null) o = { ...o, onByDefault: Boolean(ov.on_by_default) };
          return o;
        })
        .filter((o) => {
          const ov = byId.get(o.id);
          return !(ov && ov.on_by_default === false && ov.sold_out_override); // keep unless deleted
        });
    }

    resolved.push({
      listId: list.id,
      name: list.name,
      modifierType: list.modifierType,
      required,
      maxTextLength: list.maxTextLength > 0 ? list.maxTextLength : isText ? 255 : 0,
      minSelected: isText ? (required ? 1 : 0) : minSelected,
      maxSelected: isText ? 1 : maxSelected,
      ordinal: asInt(info.ordinal, list.ordinal),
      options: isText ? [] : options,
    });
  }

  resolved.sort((a, b) => a.ordinal - b.ordinal || a.name.localeCompare(b.name));
  return resolved;
}
