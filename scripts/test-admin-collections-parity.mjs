#!/usr/bin/env node
/**
 * Admin collections must use Square-derived lists — never seed-only orphans.
 * Run: node scripts/test-admin-collections-parity.mjs
 */
import assert from "node:assert/strict";
import {
  detectSquareCollections,
  buildCollectionsFromProducts,
} from "../js/catalog.js";
import { collectionCoverSrc } from "../js/collection-assets.js";

const products = [
  {
    name: "A",
    collectionNames: ["Moon, Sun, and Stars"],
    collectionName: "Moon, Sun, and Stars",
  },
  {
    name: "B",
    collectionNames: ["Moon, Sun, and Stars"],
    collectionName: "Moon, Sun, and Stars",
  },
];

const raw = {
  collectionOptions: ["Moon, Sun, and Stars", "Ocean Wonders", "Witches Lane"],
};

const pub = buildCollectionsFromProducts(products);
assert.equal(pub.length, 1);
assert.equal(pub[0].name, "Moon, Sun, and Stars");
assert.equal(pub[0].productCount, 2);
assert.equal(pub[0].image, "/assets/collections/moon-sun-and-stars.png");

const admin = detectSquareCollections(products, raw, { includeEmptyOptions: true });
assert.equal(admin.length, 3);
assert.deepEqual(
  admin.map((c) => c.name).sort(),
  ["Moon, Sun, and Stars", "Ocean Wonders", "Witches Lane"]
);
assert.equal(admin.find((c) => c.name === "Ocean Wonders").productCount, 0);
assert.equal(admin.find((c) => c.name === "Moon, Sun, and Stars").productCount, 2);

// No seed inventing "Nocturnal" etc.
assert.equal(
  admin.some((c) => /nocturnal|wild things|tide/i.test(c.name)),
  false
);

assert.equal(collectionCoverSrc("Ocean").startsWith("/assets/"), true);

console.log("test-admin-collections-parity: all passed");
