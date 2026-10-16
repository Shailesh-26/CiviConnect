import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { computePriority, priorityLabel } from "../src/utils/priority";

const now = new Date();
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

test("priority: hazard alone for a fresh single report", () => {
  assert.equal(computePriority({ category: "pothole", reportCount: 1, supporterCount: 0, createdAt: now }), 35);
  assert.equal(computePriority({ category: "fallen_tree", reportCount: 1, supporterCount: 0, createdAt: now }), 45);
});

test("priority: merged reports, support and age add up", () => {
  // 40 hazard + 2 extra reports * 3 + 4 supporters * 1.5 + 2 days
  assert.equal(computePriority({ category: "drainage", reportCount: 3, supporterCount: 4, createdAt: daysAgo(2) }), 54);
});

test("priority: each part is capped and the total never passes 100", () => {
  const p = computePriority({ category: "fallen_tree", reportCount: 50, supporterCount: 50, createdAt: daysAgo(90), escalated: true });
  assert.equal(p, 100);
  const noEsc = computePriority({ category: "other", reportCount: 50, supporterCount: 50, createdAt: daysAgo(90) });
  assert.equal(noEsc, 20 + 30 + 15 + 10);
});

test("priority: escalation adds 15", () => {
  const base = computePriority({ category: "garbage", reportCount: 1, supporterCount: 0, createdAt: now });
  const esc = computePriority({ category: "garbage", reportCount: 1, supporterCount: 0, createdAt: now, escalated: true });
  assert.equal(esc - base, 15);
});

test("priority: labels", () => {
  assert.equal(priorityLabel(70), "high");
  assert.equal(priorityLabel(69), "medium");
  assert.equal(priorityLabel(40), "medium");
  assert.equal(priorityLabel(39), "low");
});
