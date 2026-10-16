import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createIssueSchema } from "../src/validators/issue.schemas";

const base = { category: "pothole", description: "Deep pothole near the bus stop", lat: "17.43", lng: "78.44" };

test("report: valid multipart fields are parsed and coerced", () => {
  const r = createIssueSchema.parse(base);
  assert.equal(r.lat, 17.43);
  assert.equal(r.aiVerdict, undefined);
});

test("report: short descriptions and missing pins are rejected", () => {
  assert.equal(createIssueSchema.safeParse({ ...base, description: "bad" }).success, false);
  assert.equal(createIssueSchema.safeParse({ ...base, lat: "" }).success, false);
  assert.equal(createIssueSchema.safeParse({ ...base, lat: "200" }).success, false);
});

test("report: the Photo Assistant suggestion is kept when valid", () => {
  const r = createIssueSchema.parse({ ...base, aiVerdict: "confident", aiCategory: "pothole", aiConfidence: "0.87", aiMode: "zero-shot" });
  assert.deepEqual([r.aiVerdict, r.aiCategory, r.aiConfidence, r.aiMode], ["confident", "pothole", 0.87, "zero-shot"]);
});

test("report: a bad Photo Assistant value never blocks the report", () => {
  const r = createIssueSchema.parse({ ...base, aiVerdict: "hacked", aiCategory: "volcano", aiConfidence: "7", aiMode: "" });
  assert.deepEqual([r.aiVerdict, r.aiCategory, r.aiConfidence, r.aiMode], [undefined, undefined, undefined, undefined]);
});
