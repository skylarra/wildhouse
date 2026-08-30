#!/usr/bin/env node
/**
 * Lightweight checks for Square Collection + Featured attribute → catalog transform.
 * Run: node scripts/test-collection-attr.mjs
 */
import assert from "node:assert/strict";
import {
  slugify,
  readCollectionNames,
  buildSelectionNameMap,
  buildAttributeDefinitionIndex,
  listCollectionOptionNames,
  squareToCatalog,
  isFeaturedItem,
  collectItemAttributeValues,
} from "../functions/api/_square.js";

assert.equal(slugify("Witches Lane"), "witches-lane");
assert.equal(slugify("Moon, Sun & Stars"), "moon-sun-stars");
assert.equal(slugify("Tide & Marsh"), "tide-marsh");

assert.deepEqual(
  readCollectionNames({
    a: { name: "Collection", string_value: "Moon, Sun & Stars" },
  }),
  ["Moon, Sun & Stars"]
);

// Square often keys the map by definition key and omits `name` on the value.
assert.deepEqual(
  readCollectionNames({
    Collection: { type: "STRING", string_value: "Nocturnal" },
  }),
  ["Nocturnal"]
);

const definitions = [
  {
    type: "CUSTOM_ATTRIBUTE_DEFINITION",
    id: "DEF_COLLECTION",
    custom_attribute_definition_data: {
      name: "Collection",
      key: "Collection",
      type: "SELECTION",
      selection_config: {
        max_allowed_selections: 1,
        allowed_selections: [
          { uid: "UID1", name: "Witches Lane" },
          { uid: "UID2", name: "Moon, Sun, and Stars" },
          { uid: "UID3", name: "Wild Things" },
        ],
      },
    },
  },
  {
    type: "CUSTOM_ATTRIBUTE_DEFINITION",
    id: "DEF_FEATURED",
    custom_attribute_definition_data: {
      name: "Featured",
      key: "Featured",
      type: "BOOLEAN",
    },
  },
];

const selMap = buildSelectionNameMap(definitions);
const defIndex = buildAttributeDefinitionIndex(definitions);

assert.deepEqual(
  readCollectionNames(
    {
      // Map key is the only identity — no name/key on the value object.
      Collection: {
        type: "SELECTION",
        custom_attribute_definition_id: "DEF_COLLECTION",
        selection_uid_values: ["UID1"],
      },
    },
    selMap,
    defIndex
  ),
  ["Witches Lane"]
);

// Opaque map key — identify via custom_attribute_definition_id.
assert.deepEqual(
  readCollectionNames(
    {
      opaque_key_xyz: {
        type: "SELECTION",
        custom_attribute_definition_id: "DEF_COLLECTION",
        selection_uid_values: ["UID2"],
      },
    },
    selMap,
    defIndex
  ),
  ["Moon, Sun, and Stars"]
);

assert.deepEqual(listCollectionOptionNames(definitions, defIndex), [
  "Witches Lane",
  "Moon, Sun, and Stars",
  "Wild Things",
]);

// Featured: map-key only + boolean true
assert.equal(
  isFeaturedItem(
    {
      Featured: {
        type: "BOOLEAN",
        custom_attribute_definition_id: "DEF_FEATURED",
        boolean_value: true,
      },
    },
    defIndex
  ),
  true
);

assert.equal(
  isFeaturedItem(
    {
      Featured: {
        type: "BOOLEAN",
        custom_attribute_definition_id: "DEF_FEATURED",
        boolean_value: false,
      },
    },
    defIndex
  ),
  false
);

// Featured via definition id when map key is opaque
assert.equal(
  isFeaturedItem(
    {
      sq_app_random: {
        type: "BOOLEAN",
        custom_attribute_definition_id: "DEF_FEATURED",
        boolean_value: true,
      },
    },
    defIndex
  ),
  true
);

const catalog = squareToCatalog(
  [
    {
      type: "CATEGORY",
      id: "CAT_KEY",
      category_data: { name: "Keychains & Charms" },
    },
    ...definitions,
    {
      type: "ITEM",
      id: "ITEM1",
      custom_attribute_values: {
        Collection: {
          type: "SELECTION",
          custom_attribute_definition_id: "DEF_COLLECTION",
          selection_uid_values: ["UID1"],
        },
        Featured: {
          type: "BOOLEAN",
          custom_attribute_definition_id: "DEF_FEATURED",
          boolean_value: true,
        },
      },
      item_data: {
        name: "Shattered Star Keychain",
        category_id: "CAT_KEY",
        variations: [
          {
            id: "VAR1",
            item_variation_data: {
              name: "Regular",
              price_money: { amount: 1200, currency: "USD" },
            },
          },
        ],
      },
    },
    {
      type: "ITEM",
      id: "ITEM2",
      item_data: {
        name: "Plain Tee",
        category_id: "CAT_KEY",
        variations: [
          {
            id: "VAR2",
            item_variation_data: {
              name: "Regular",
              price_money: { amount: 2000, currency: "USD" },
            },
          },
        ],
      },
    },
    {
      // Featured only on variation (allowed_object_types may include ITEM_VARIATION)
      type: "ITEM",
      id: "ITEM3",
      item_data: {
        name: "Variation Featured Charm",
        category_id: "CAT_KEY",
        variations: [
          {
            id: "VAR3",
            custom_attribute_values: {
              Featured: {
                type: "BOOLEAN",
                custom_attribute_definition_id: "DEF_FEATURED",
                boolean_value: true,
              },
            },
            item_variation_data: {
              name: "Regular",
              price_money: { amount: 900, currency: "USD" },
            },
          },
        ],
      },
    },
  ],
  [{ catalog_object_id: "VAR1", quantity: 3 }]
);

const withCollection = catalog.objects.find((o) => o.id === "ITEM1");
const without = catalog.objects.find((o) => o.id === "ITEM2");
const varFeatured = catalog.objects.find((o) => o.id === "ITEM3");
assert.equal(withCollection.custom.collection, "Witches Lane");
assert.deepEqual(withCollection.custom.collections, ["Witches Lane"]);
assert.equal(withCollection.custom.featured, true);
assert.equal(withCollection.item_data.category_id, "CAT_KEY");
assert.equal(without.custom.collection, null);
assert.deepEqual(without.custom.collections, []);
assert.equal(without.custom.featured, false);
assert.equal(varFeatured.custom.featured, true);
assert.deepEqual(catalog.collectionOptions, [
  "Witches Lane",
  "Moon, Sun, and Stars",
  "Wild Things",
]);

const mergedAttrs = collectItemAttributeValues({
  custom_attribute_values: { Collection: { string_value: "A" } },
  item_data: {
    custom_attribute_values: { Featured: { boolean_value: true } },
    variations: [],
  },
});
assert.equal(mergedAttrs.Collection.string_value, "A");
assert.equal(mergedAttrs.Featured.boolean_value, true);

console.log("test-collection-attr: all passed");
