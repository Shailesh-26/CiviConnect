import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { cosine, parseVector } from "../src/utils/vectors";
import { fixVerdict, SAME_PLACE_MIN, STILL_VISIBLE_MIN } from "../src/utils/fixCheck";

test("vectors: cosine similarity", () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.ok(Math.abs(cosine([1, 1], [2, 2]) - 1) < 1e-9);
  assert.equal(cosine([1, 2], [1, 2, 3]), 0);
  assert.equal(cosine([], []), 0);
});

test("vectors: browser input is checked", () => {
  assert.equal(parseVector("nope"), null);
  assert.equal(parseVector([1, 2, 3]), null);
  assert.equal(parseVector(Array(32).fill(0.1).map((v, i) => (i === 5 ? "x" : v))), null);
  assert.equal(parseVector(Array(32).fill(0.1))?.length, 32);
});

test("fix check: same place and problem gone looks fixed", () => {
  assert.equal(fixVerdict({ issueCategory: "pothole", similarity: 0.88, proofTop: { category: "pothole", score: 0.5 }, proofCivic: 0.7 }), "looks_fixed");
});

test("fix check: the problem still clearly visible is flagged", () => {
  assert.equal(fixVerdict({ issueCategory: "garbage", similarity: 0.9, proofTop: { category: "garbage", score: STILL_VISIBLE_MIN + 0.05 }, proofCivic: 0.9 }), "still_visible");
});

test("fix check: a photo of a different place is flagged", () => {
  assert.equal(fixVerdict({ issueCategory: "pothole", similarity: SAME_PLACE_MIN - 0.1, proofTop: { category: "streetlight", score: 0.9 }, proofCivic: 0.8 }), "different_place");
});

test("fix check: nothing to compare with is not held against the officer", () => {
  assert.equal(fixVerdict({ issueCategory: "pothole", similarity: null, proofTop: null, proofCivic: 0 }), "looks_fixed");
});

import { splitByRelevance, SEARCH_MIN_SCORE } from "../src/utils/searchRelevance";

test("photo search keeps only photos close to the best match", () => {
  const ranked = [0.31, 0.3, 0.285, 0.24, 0.22, 0.2, 0.15].map((s) => ({ s }));
  const { strong, looser } = splitByRelevance(ranked, (x) => x.s, 24);
  assert.deepEqual(strong.map((x) => x.s), [0.31, 0.3, 0.285]);
  assert.deepEqual(looser.map((x) => x.s), [0.24, 0.22, 0.2]);
});

test("photo search returns no strong matches when nothing is similar", () => {
  const ranked = [0.17, 0.16, 0.12].map((s) => ({ s }));
  const { strong, looser } = splitByRelevance(ranked, (x) => x.s, 24);
  assert.equal(strong.length, 0);
  assert.ok(looser.every((x) => x.s >= SEARCH_MIN_SCORE - 0.03));
});
