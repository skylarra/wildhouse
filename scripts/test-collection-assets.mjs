#!/usr/bin/env node
/**
 * Collection cover filename normalization.
 * Run: node scripts/test-collection-assets.mjs
 */
import assert from "node:assert/strict";
import {
  normalizeCollectionKey,
  collectionCoverFilename,
  collectionCoverSrc,
  COLLECTION_COVER_DIR,
} from "../js/collection-assets.js";

assert.equal(normalizeCollectionKey("Sun, Moon, And Stars"), "sun-moon-and-stars");
assert.equal(normalizeCollectionKey("Midnight Light"), "midnight-light");
assert.equal(normalizeCollectionKey("Ocean"), "ocean");
assert.equal(normalizeCollectionKey("Spooky"), "spooky");
assert.equal(normalizeCollectionKey("Moon, Sun & Stars"), "moon-sun-and-stars");
assert.equal(normalizeCollectionKey("  Tide & Marsh  "), "tide-and-marsh");
assert.equal(normalizeCollectionKey("Wild Things"), "wild-things");

assert.equal(collectionCoverFilename("Sun, Moon, And Stars"), "sun-moon-and-stars.png");
assert.equal(collectionCoverFilename("Midnight Light"), "midnight-light.png");
assert.equal(collectionCoverFilename("Ocean"), "ocean.png");
assert.equal(collectionCoverFilename("Spooky"), "spooky.png");

assert.equal(
  collectionCoverSrc("Midnight Light"),
  `${COLLECTION_COVER_DIR}/midnight-light.png`
);

console.log("test-collection-assets: all passed");
