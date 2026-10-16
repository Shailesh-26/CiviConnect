import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { computePriority } from "../src/utils/priority";
import { EMERGENCY_SLA_HOURS, slaInfo } from "../src/services/sla";
import { suggest } from "../src/services/routing";
import { createIssueSchema, emergencySchema } from "../src/validators/issue.schemas";
import { forgotSchema, resetSchema } from "../src/validators/auth.schemas";
import { leaveSchema } from "../src/validators/admin.schemas";
import { emailLayout, mailConfigured, sendMail } from "../src/services/mailer";

const now = new Date();

test("emergency: adds 25 to priority", () => {
  const base = computePriority({ category: "streetlight", reportCount: 1, supporterCount: 0, createdAt: now });
  const urgent = computePriority({ category: "streetlight", reportCount: 1, supporterCount: 0, createdAt: now, emergency: true });
  assert.equal(urgent - base, 25);
});

test("emergency: 4-hour clock, warning in the last hour", () => {
  assert.equal(EMERGENCY_SLA_HOURS, 4);
  const at = (h: number) => new Date(Date.now() - h * 3_600_000);
  const due = (from: Date) => new Date(from.getTime() + 4 * 3_600_000);
  const fresh = at(0.5);
  assert.equal(slaInfo({ category: "streetlight", status: "reported", createdAt: fresh, slaDueAt: due(fresh), emergency: true }).hours, 4);
  assert.equal(slaInfo({ category: "streetlight", status: "reported", createdAt: fresh, slaDueAt: due(fresh), emergency: true }).state, "ok");
  const late = at(3.5);
  assert.equal(slaInfo({ category: "streetlight", status: "reported", createdAt: late, slaDueAt: due(late), emergency: true }).state, "warning");
});

test("emergency: report field and toggle are validated", () => {
  const base = { category: "streetlight", description: "Live wire hanging near the school gate", lat: "17.4", lng: "78.4" };
  assert.equal(createIssueSchema.parse({ ...base, emergencyKind: "live_wire" }).emergencyKind, "live_wire");
  assert.equal(createIssueSchema.parse({ ...base, emergencyKind: "earthquake" }).emergencyKind, undefined);
  assert.equal(emergencySchema.safeParse({ emergency: "yes" }).success, false);
  assert.deepEqual(emergencySchema.parse({ emergency: true, kind: "open_manhole" }), { emergency: true, kind: "open_manhole" });
});

test("leave: routing never suggests an officer on leave", () => {
  const away = { _id: new Types.ObjectId(), name: "Ravi", department: "Roads and Pavements", onLeaveSince: new Date() };
  const here = { _id: new Types.ObjectId(), name: "Kiran", department: "Roads and Pavements" };
  const pick = suggest("pothole", [away, here], new Map([[`${away._id}:pothole`, 50]]), new Map());
  assert.equal(pick?.name, "Kiran");
  assert.equal(suggest("pothole", [away], new Map(), new Map()), null);
});

test("leave: end date must be within 90 days", () => {
  const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
  assert.equal(leaveSchema.safeParse({ onLeave: true, leaveUntil: inDays(5) }).success, true);
  assert.equal(leaveSchema.safeParse({ onLeave: true, leaveUntil: inDays(200) }).success, false);
  assert.equal(leaveSchema.safeParse({ onLeave: true, leaveUntil: "2020-01-01" }).success, false);
  assert.equal(leaveSchema.parse({ onLeave: false }).onLeave, false);
});

test("password reset: email and token formats", () => {
  assert.equal(forgotSchema.safeParse({ email: "not-an-email" }).success, false);
  assert.equal(resetSchema.safeParse({ token: "abc", password: "Secret123" }).success, false);
  assert.equal(resetSchema.safeParse({ token: "a".repeat(64), password: "short" }).success, false);
  assert.equal(resetSchema.safeParse({ token: "a".repeat(64), password: "Secret123" }).success, true);
});

test("mailer: without SMTP settings the email is printed, not sent", async () => {
  assert.equal(mailConfigured, false);
  const logged: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => void logged.push(args.join(" "));
  try {
    assert.equal(await sendMail({ to: "a@b.c", subject: "Hi", text: "Link: http://x", html: emailLayout("Hi", ["x"]) }), false);
  } finally {
    console.log = original;
  }
  assert.match(logged.join("\n"), /Link: http:\/\/x/);
});
