import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SLA_HOURS, dueFrom, slaInfo } from "../src/services/sla";

const H = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * H);

test("sla: default fix-by hours per category", () => {
  assert.deepEqual(DEFAULT_SLA_HOURS, { pothole: 72, garbage: 48, drainage: 48, streetlight: 72, fallen_tree: 24, other: 120 });
});

test("sla: due date is created + category hours", () => {
  const from = new Date("2026-01-01T00:00:00Z");
  assert.equal(dueFrom("fallen_tree", from).toISOString(), "2026-01-02T00:00:00.000Z");
});

test("sla: ok, warning at the last quarter, breached when overdue", () => {
  assert.equal(slaInfo({ category: "fallen_tree", status: "reported", createdAt: ago(1) }).state, "ok");
  assert.equal(slaInfo({ category: "fallen_tree", status: "acknowledged", createdAt: ago(20) }).state, "warning");
  assert.equal(slaInfo({ category: "fallen_tree", status: "in_progress", createdAt: ago(25) }).state, "breached");
});

test("sla: resolved on time is met, late is missed, rejected has no clock", () => {
  const createdAt = ago(100);
  assert.equal(slaInfo({ category: "garbage", status: "resolved", createdAt, resolvedAt: ago(80) }).state, "met");
  assert.equal(slaInfo({ category: "garbage", status: "resolved", createdAt, resolvedAt: ago(10) }).state, "missed");
  assert.equal(slaInfo({ category: "garbage", status: "rejected", createdAt }).state, "none");
});
