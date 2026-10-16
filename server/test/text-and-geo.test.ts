import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseLabel } from "../src/utils/customIcons";
import { areaOf, metres } from "../src/utils/geo";
import { similarity, words } from "../src/utils/textMatch";

test("geo: haversine distance is right to within a metre", () => {
  // 0.001 degree of latitude is about 111 m
  const d = metres({ lat: 17.4, lng: 78.4 }, { lat: 17.401, lng: 78.4 });
  assert.ok(Math.abs(d - 111.2) < 1, `got ${d}`);
  assert.equal(metres({ lat: 1, lng: 1 }, { lat: 1, lng: 1 }), 0);
});

test("geo: area is the last part of the landmark", () => {
  assert.equal(areaOf("Near metro station, Ameerpet"), "Ameerpet");
  assert.equal(areaOf(""), "Unnamed area");
  assert.equal(areaOf(null), "Unnamed area");
});

test("text: stop words and short words are ignored", () => {
  assert.deepEqual([...words("The big pothole is near the bus stop!")].sort(), ["big", "bus", "pothole", "stop"]);
});

test("text: similarity is 1 for the same words, 0 for nothing shared", () => {
  assert.equal(similarity("deep pothole bus stop", "bus stop deep pothole"), 1);
  assert.equal(similarity("garbage pile", "street light broken"), 0);
  assert.equal(similarity("", "anything"), 0);
});

test("labels: custom problem names merge regardless of case and punctuation", () => {
  assert.equal(normaliseLabel("Open  Manhole!"), normaliseLabel("open manhole"));
});
