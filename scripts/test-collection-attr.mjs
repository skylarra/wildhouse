#!/usr/bin/env node
/**
 * Lightweight checks for Square Collection attribute → catalog transform.
 * Run: node scripts/test-collection-attr.mjs
 */
import assert from "node:assert/strict";
import {
  slugify,
  readCollectionNames,
  buildSelectionNameMap,
  squareToCatalog,
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

const selMap = buildSelectionNameMap([
  {
    type: "CUSTOM_ATTRIBUTE_DEFINITION",
    custom_attribute_definition_data: {
      name: "Collection",
      selection_config: {
        allowed_selections: [{ uid: "UID1", name: "Witches Lane" }],
      },
    },
  },
]);
assert.deepEqual(
  readCollectionNames(
    { a: { name: "Collection", selection_uid_values: ["UID1"] } },
    selMap
  ),
  ["Witches Lane"]
);

const catalog = squareToCatalog(
  [
    {
      type: "CATEGORY",
      id: "CAT_KEY",
      category_data: { name: "Keychains & Charms" },
    },
    {
      type: "ITEM",
      id: "ITEM1",
      custom_attribute_values: {
        c: { name: "Collection", string_value: "Witches Lane" },
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
  ],
  [{ catalog_object_id: "VAR1", quantity: 3 }]
);

const withCollection = catalog.objects.find((o) => o.id === "ITEM1");
const without = catalog.objects.find((o) => o.id === "ITEM2");
assert.equal(withCollection.custom.collection, "Witches Lane");
assert.deepEqual(withCollection.custom.collections, ["Witches Lane"]);
assert.equal(withCollection.item_data.category_id, "CAT_KEY");
assert.equal(without.custom.collection, null);
assert.deepEqual(without.custom.collections, []);

console.log("test-collection-attr: all passed");
