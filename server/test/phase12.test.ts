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

import { pickRivals, splitByRelevance, strongestRival, SEARCH_MIN_SCORE } from "../src/utils/searchRelevance";

test("photo search keeps only photos close to the best match", () => {
  const ranked = [0.36, 0.34, 0.3, 0.27, 0.22, 0.2, 0.15].map((s) => ({ s }));
  const { strong, looser } = splitByRelevance(ranked, (x) => x.s, 24);
  assert.deepEqual(strong.map((x) => x.s), [0.36, 0.34, 0.3]);
  assert.deepEqual(looser.map((x) => x.s), [0.27, 0.22, 0.2]);
});

test("photo search returns no strong matches when nothing is similar", () => {
  const ranked = [0.17, 0.16, 0.12].map((s) => ({ s }));
  const { strong, looser } = splitByRelevance(ranked, (x) => x.s, 24);
  assert.equal(strong.length, 0);
  assert.ok(looser.every((x) => x.s >= SEARCH_MIN_SCORE - 0.03));
});

test("a photo that looks more like another problem is not a match", () => {
  const ranked = [
    { s: 0.3, beats: false }, // e.g. a street light with litter around it, searching "garbage"
    { s: 0.29, beats: true },
    { s: 0.28, beats: true },
  ];
  const { strong, looser } = splitByRelevance(ranked, (x) => x.s, 24, (x) => x.beats);
  assert.deepEqual(strong.map((x) => x.s), [0.29, 0.28]);
  assert.deepEqual(looser.map((x) => x.s), [0.3]);
});

test("the rival that means the same as the search words is ignored", () => {
  const unit = (v: number[]) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
  const query = unit([1, 0.1, 0, ...Array(13).fill(0)]);
  const rivals = [
    { key: "garbage", vector: unit([1, 0.12, 0, ...Array(13).fill(0)]) },
    { key: "streetlight", vector: unit([0, 0, 1, ...Array(13).fill(0)]) },
  ];
  const kept = pickRivals(query, rivals);
  assert.deepEqual(kept.map((r) => r.key), ["streetlight"]);
  const photo = unit([0.2, 0, 1, ...Array(13).fill(0)]);
  assert.equal(strongestRival(photo, kept)?.key, "streetlight");
});

// Real numbers from "npm run vision:search -- garbage" on the demo city (2026-10-20):
// [score for "garbage", the photo's real category, strongest other category score].
test("photo search on real scores for garbage keeps the garbage photos and drops the rest", () => {
  const rows: [number, string, number][] = [
    [0.284, "garbage", 0.207], [0.26, "garbage", 0.232], [0.258, "streetlight", 0.307], [0.257, "streetlight", 0.287],
    [0.255, "garbage", 0.192], [0.243, "garbage", 0.233], [0.233, "drainage", 0.333], [0.231, "drainage", 0.26],
    [0.231, "garbage", 0.232], [0.23, "garbage", 0.213], [0.228, "drainage", 0.275], [0.226, "pothole", 0.29],
    [0.224, "garbage", 0.214], [0.223, "garbage", 0.23], [0.219, "streetlight", 0.275], [0.218, "garbage", 0.235],
  ];
  const ranked = rows.map(([s, category, rival]) => ({ s, category, beats: s >= rival - 0.005 }));
  const { strong } = splitByRelevance(ranked, (x) => x.s, 24, (x) => x.beats);
  assert.ok(strong.length >= 7);
  assert.ok(strong.every((x) => x.category === "garbage"));
});

import { csvCell, toCsv } from "../src/utils/csv";

test("CSV cells are escaped and never run as spreadsheet formulas", () => {
  assert.equal(csvCell('He said "hi", then left'), '"He said ""hi"", then left"');
  assert.equal(csvCell("=HYPERLINK(\"http://x\")"), `"'=HYPERLINK(""http://x"")"`);
  assert.equal(csvCell("+91 98765"), "'+91 98765");
  assert.equal(csvCell("-5"), "'-5");
  assert.equal(csvCell(-5), "-5"); // real numbers stay numbers
  assert.equal(csvCell(null), "");
  assert.ok(toCsv(["a"], [["x"]]).startsWith("﻿a\r\nx"));
});
