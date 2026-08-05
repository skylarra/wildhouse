// Parse Square-style variation names into option axes (Color / Size, etc.).
// Expected name patterns: "Black / M", "Sand / XL", "Oak - Large".
// Falls back to a single "Option" axis when names are not multi-part.

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "4XL"];
const SIZE_RE = /^(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|\d{1,2})$/i;

export function splitName(name = "") {
  const parts = String(name)
    .split(/\s*[\/|–—-]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : [String(name || "Default")];
}

function sortSizeValues(values) {
  return [...values].sort((a, b) => {
    const ai = SIZE_ORDER.findIndex((s) => s.toLowerCase() === a.toLowerCase());
    const bi = SIZE_ORDER.findIndex((s) => s.toLowerCase() === b.toLowerCase());
    if (ai !== -1 || bi !== -1) {
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    }
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

function uniqueInOrder(values) {
  const seen = new Set();
  const out = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/**
 * Build a selectable matrix from product variations.
 * @returns {{ mode: 'matrix'|'list'|'none', axes: Array, findVariation: Function }}
 */
export function buildVariantModel(variations = []) {
  if (!variations.length) {
    return { mode: "none", axes: [], rows: [], findVariation: () => null };
  }
  if (variations.length === 1) {
    return {
      mode: "none",
      axes: [],
      rows: variations.map((v) => ({ variation: v, parts: splitName(v.name) })),
      findVariation: () => variations[0],
    };
  }

  const rows = variations.map((v) => ({ variation: v, parts: splitName(v.name) }));
  const partCounts = new Set(rows.map((r) => r.parts.length));
  const canMatrix = partCounts.size === 1 && rows[0].parts.length >= 2;

  if (!canMatrix) {
    const values = uniqueInOrder(rows.map((r) => r.parts[0]));
    const looksLikeSize = values.every((v) => SIZE_RE.test(v));
    return {
      mode: "list",
      axes: [
        {
          key: looksLikeSize ? "size" : "option",
          label: looksLikeSize ? "Size" : "Option",
          values: looksLikeSize ? sortSizeValues(values) : values,
          presentation: looksLikeSize ? "chips" : "swatches",
        },
      ],
      rows,
      findVariation(selection) {
        const value = selection.option || selection.size || selection.color;
        return variations.find((v) => splitName(v.name)[0] === value) || null;
      },
    };
  }

  const axisCount = rows[0].parts.length;
  const axisValues = Array.from({ length: axisCount }, (_, i) =>
    uniqueInOrder(rows.map((r) => r.parts[i]))
  );

  // Prefer Color then Size when the second axis looks like apparel sizes.
  const axes = axisValues.map((values, i) => {
    const looksLikeSize = values.every((v) => SIZE_RE.test(v));
    if (i === 0 && !looksLikeSize) {
      return {
        key: "color",
        label: "Color",
        values,
        presentation: "swatches",
      };
    }
    if (looksLikeSize) {
      return {
        key: "size",
        label: "Size",
        values: sortSizeValues(values),
        presentation: "chips",
      };
    }
    return {
      key: `option${i}`,
      label: i === 0 ? "Style" : `Option ${i + 1}`,
      values,
      presentation: "chips",
    };
  });

  // Ensure unique keys if both axes are non-size styles.
  const used = new Set();
  for (const axis of axes) {
    let key = axis.key;
    let n = 2;
    while (used.has(key)) {
      key = `${axis.key}${n++}`;
    }
    axis.key = key;
    used.add(key);
  }

  return {
    mode: "matrix",
    axes,
    rows,
    findVariation(selection) {
      return (
        rows.find((row) =>
          axes.every((axis, i) => row.parts[i] === selection[axis.key])
        )?.variation || null
      );
    },
  };
}

/** Resolve a display image for a color/option value. */
export function resolveOptionImage({
  value,
  valueIndex = 0,
  productImages = [],
  colorImages = {},
  variationsForValue = [],
}) {
  if (colorImages?.[value]) return colorImages[value];
  const withImage = variationsForValue.find((v) => v.image);
  if (withImage?.image) return withImage.image;
  if (productImages[valueIndex]) return productImages[valueIndex];
  return productImages[0] || "./assets/coming-soon.png";
}

export function defaultSelection(model, variations) {
  const selection = {};
  if (model.mode === "none") return selection;

  // Prefer an in-stock variation's parts as the starting selection.
  const preferred = variations.find((v) => v.stock > 0) || variations[0];
  const parts = splitName(preferred?.name);
  model.axes.forEach((axis, i) => {
    selection[axis.key] = parts[i] || axis.values[0];
  });

  // If that combination is somehow missing, walk axes for first available stock.
  if (!model.findVariation(selection)?.stock) {
    for (const color of model.axes[0]?.values || []) {
      selection[model.axes[0].key] = color;
      for (const size of model.axes[1]?.values || [null]) {
        if (model.axes[1]) selection[model.axes[1].key] = size;
        const match = model.findVariation(selection);
        if (match?.stock > 0) return selection;
      }
    }
  }
  return selection;
}
