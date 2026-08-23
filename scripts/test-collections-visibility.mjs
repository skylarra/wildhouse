#!/usr/bin/env node
/**
 * Collection visibility / merge rules.
 * Run: node scripts/test-collections-visibility.mjs
 */
import assert from "node:assert/strict";
import {
  normalizeCollectionsConfig,
  mergeCollectionsWithConfig,
  isPublicCollection,
  defaultConfigForNewCollection,
  toSavableConfig,
} from "../js/collections-config.js";

const config = normalizeCollectionsConfig({
  entries: [
    {
      collectionKey: "witches-lane",
      displayName: "Witches Lane",
      visible: true,
      featured: true,
      sortOrder: 1,
      description: "Witchy",
    },
    {
      collectionKey: "nocturnal",
      displayName: "Nocturnal",
      visible: false,
      featured: true,
      sortOrder: 2,
    },
  ],
});

const detected = [
  { handle: "witches-lane", name: "Witches Lane", count: 12, image: "a.jpg" },
  { handle: "nocturnal", name: "Nocturnal", count: 6, image: "b.jpg" },
  { handle: "wild-things", name: "Wild Things", count: 3, image: "c.jpg" },
];

const merged = mergeCollectionsWithConfig(detected, config);
const byKey = Object.fromEntries(merged.map((c) => [c.collectionKey, c]));

assert.equal(byKey["witches-lane"].visible, true);
assert.equal(byKey["nocturnal"].visible, false);
assert.equal(byKey["nocturnal"].featured, true); // raw flag preserved
assert.equal(byKey["wild-things"].visible, false); // new → hidden
assert.equal(byKey["wild-things"].isNew, true);

assert.equal(isPublicCollection(byKey["witches-lane"]), true);
assert.equal(isPublicCollection(byKey["nocturnal"]), false);
assert.equal(isPublicCollection(byKey["wild-things"]), false);
assert.equal(isPublicCollection({ visible: true, productCount: 0 }), false);

// Empty but configured collection preserved
const withEmpty = mergeCollectionsWithConfig(
  [{ handle: "witches-lane", name: "Witches Lane", count: 0, image: "" }],
  config
);
assert.ok(withEmpty.find((c) => c.collectionKey === "nocturnal"));
assert.equal(withEmpty.find((c) => c.collectionKey === "witches-lane").productCount, 0);
assert.equal(isPublicCollection(withEmpty.find((c) => c.collectionKey === "witches-lane")), false);

const neu = defaultConfigForNewCollection("Christmas", 99);
assert.equal(neu.visible, false);
assert.equal(neu.featured, false);
assert.equal(neu.collectionKey, "christmas");

const saved = toSavableConfig(merged);
assert.equal(saved.version, 2);
assert.ok(saved.entries.every((e) => "visible" in e && "sortOrder" in e));

console.log("test-collections-visibility: all passed");
