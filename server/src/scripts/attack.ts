/**
 * Hostile-reviewer checks: `npm run attack` (with `npm run dev` running in another terminal).
 * Logs in as the seed admin, creates throw-away officers, citizens and reports, tries to break the
 * rules (wrong roles, someone else's data, bad input, fake files, double clicks, two people acting at
 * once), prints PASS/FAIL for each, then deletes everything it created.
 * Reports are placed in the Arabian Sea so they never merge with real ones.
 */
import mongoose, { type Types } from "mongoose";
import { env } from "../config/env";
import { AuditLog } from "../models/AuditLog";
import { Comment } from "../models/Comment";
import { Flag } from "../models/Flag";
import { Issue } from "../models/Issue";
import { Notification } from "../models/Notification";
import { User } from "../models/User";

const BASE = (process.env.ATTACK_URL ?? `http://localhost:${env.PORT}`).replace(/\/+$/, "") + "/api";
const DOMAIN = "attack.civiconnect.test";
const run = Date.now().toString(36);
let passed = 0;
const failed: string[] = [];

function check(name: string, ok: boolean, got: unknown = "") {
  if (ok) passed++;
  else failed.push(name);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `   (got ${typeof got === "string" ? got : JSON.stringify(got)})`}`);
}

type Res = { status: number; data: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
function client() {
  let cookie = "";
  async function req(method: string, path: string, body?: unknown): Promise<Res> {
    const headers: Record<string, string> = cookie ? { cookie } : {};
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (typeof body === "string") (headers["content-type"] = "application/json"), (payload = body);
    else if (body !== undefined) (headers["content-type"] = "application/json"), (payload = JSON.stringify(body));
    const res = await fetch(BASE + path, { method, headers, body: payload });
    const set = res.headers.get("set-cookie");
    if (set?.startsWith("civiconnect_token=")) cookie = set.split(";")[0];
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* not JSON */
    }
    return { status: res.status, data };
  }
  return { req, setCookie: (c: string) => (cookie = c) };
}
type Client = ReturnType<typeof client>;

const spot = (i: number) => ({ lat: 8 + i * 0.02, lng: 68 + i * 0.02 });
const report = (c: Client, category: string, i: number, extra: Record<string, unknown> = {}) =>
  c.req("POST", "/issues", { category, description: "Large pothole near the bus stop, cars swerving", ...spot(i), ...extra });
const form = (parts: Record<string, Blob>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(parts)) f.append(k, v, `${k}.jpg`);
  return f;
};

async function attack() {
  const admin = client();
  const login = await admin.req("POST", "/auth/login", { email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD });
  if (login.status !== 200) {
    console.error(`Could not log in as the seed admin (${login.status}). Is the server running at ${BASE}? Are SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in server/.env?`);
    process.exitCode = 1;
    return;
  }

  const officer = async (n: number) => {
    const email = `officer${n}.${run}@${DOMAIN}`;
    const r = await admin.req("POST", "/admin/officers", { name: `Test Officer ${n}`, email, password: "Officer123", department: "Roads" });
    const c = client();
    await c.req("POST", "/auth/login", { email, password: "Officer123" });
    return { c, id: (r.data?.user?.id ?? r.data?.officer?.id) as string };
  };
  const citizen = async (n: number, extra: Record<string, unknown> = {}) => {
    const c = client();
    const email = `citizen${n}.${run}@${DOMAIN}`;
    const r = await c.req("POST", "/auth/register", { name: `Test Citizen ${n}`, email, password: "Citizen123", ...extra });
    return { c, r, email };
  };

  console.log("\n-- Who can do what");
  const o1 = await officer(1);
  const o2 = await officer(2);
  const c1 = await citizen(1, { role: "admin", isActive: true });
  check("Sign-up ignores role: admin", c1.r.data?.user?.role === "citizen", c1.r.data?.user?.role);
  const c2 = await citizen(2);
  for (const [m, p] of [["GET", "/admin/users"], ["GET", "/admin/audit/export"], ["GET", "/analytics/export.csv"], ["GET", "/vision/search?q=road"], ["GET", "/issues/assigned"], ["POST", "/insights/simulator"]]) {
    const r = await c1.c.req(m, p, m === "POST" ? {} : undefined);
    check(`Citizen ${m} ${p} is refused`, r.status === 403, r.status);
  }
  check("Officer cannot export the audit log", (await o1.c.req("GET", "/admin/audit/export")).status === 403);
  await c1.c.req("PATCH", "/auth/me", { role: "admin", email: "someone@else.com", isActive: false });
  const me = await c1.c.req("GET", "/auth/me");
  check("Profile edit cannot change role or email", me.data?.user?.role === "citizen" && me.data?.user?.email === c1.email, me.data?.user);

  const fake = client();
  const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from('{"sub":"000000000000000000000000"}').toString("base64url")}.`;
  fake.setCookie(`civiconnect_token=${none}`);
  check("Unsigned (alg: none) session is refused", (await fake.req("GET", "/auth/me")).status === 401);
  check("Login with {$ne: null} (NoSQL injection) is refused", (await client().req("POST", "/auth/login", { email: { $ne: null }, password: { $ne: null } })).status === 400);
  check("Password sent as an object is refused", (await client().req("POST", "/auth/login", { email: env.SEED_ADMIN_EMAIL, password: { $gt: "" } })).status === 400);

  console.log("\n-- Issue rules");
  const i1 = await report(c1.c, "pothole", 1);
  check("Citizen can report", i1.status === 201, i1.status);
  const id1 = i1.data?.issue?.id as string;
  check("Citizen cannot change status", (await c2.c.req("PATCH", `/issues/${id1}/status`, { status: "acknowledged" })).status === 403);
  check("Citizen cannot assign", (await c2.c.req("PATCH", `/issues/${id1}/assign`, { officerId: o1.id })).status === 403);
  check("Admin can assign", (await admin.req("PATCH", `/issues/${id1}/assign`, { officerId: o1.id })).status === 200);
  check("Another officer cannot change it", (await o2.c.req("PATCH", `/issues/${id1}/status`, { status: "in_progress" })).status === 403);
  check("Cannot skip a step (Acknowledged to Resolved)", (await o1.c.req("PATCH", `/issues/${id1}/status`, { status: "resolved", note: "done" })).status === 400);
  await o1.c.req("PATCH", `/issues/${id1}/status`, { status: "in_progress" });
  check("Resolving needs a note", (await o1.c.req("PATCH", `/issues/${id1}/status`, { status: "resolved" })).status === 400);
  const resolved = await o1.c.req("PATCH", `/issues/${id1}/status`, { status: "resolved", note: "Filled and rolled" });
  // With photo storage set up, a proof photo is required, which this script does not send.
  const needsPhoto = resolved.status === 400 && /photo/i.test(String(resolved.data?.message));
  check("Resolving with a note works (or asks for a proof photo)", resolved.status === 200 || needsPhoto, resolved.data?.message ?? resolved.status);
  if (resolved.status === 200) {
    check("Officer cannot vote on the fix", (await o1.c.req("POST", `/issues/${id1}/verify`, { fixed: true })).status === 403);
    check("Cannot support a closed issue", (await c2.c.req("POST", `/issues/${id1}/support`)).status === 400);
    check("Cannot reassign a closed issue", (await admin.req("PATCH", `/issues/${id1}/assign`, { officerId: o2.id })).status === 400);
  }
  const comment = await c1.c.req("POST", `/issues/${id1}/comments`, { body: "Thanks!" });
  check("Cannot delete someone else's comment", (await c2.c.req("DELETE", `/comments/${comment.data?.comment?.id}`)).status === 403);
  check("Reply target as an object is refused", (await c1.c.req("POST", `/issues/${id1}/comments`, { body: "x", parentId: { $ne: null } })).status === 400);

  console.log("\n-- Bad input");
  check("5,000-character description is refused", (await report(c1.c, "garbage", 2, { description: "a".repeat(5000) })).status === 400);
  check("Spaces-only description is refused", (await report(c1.c, "garbage", 2, { description: "            " })).status === 400);
  check("Latitude 999 is refused", (await report(c1.c, "garbage", 2, { lat: 999 })).status === 400);
  check("Blank latitude is refused", (await report(c1.c, "garbage", 2, { lat: "" })).status === 400);
  const page = await c1.c.req("GET", "/issues?page=1e20");
  check("page=1e20 does not crash", page.status === 200, page.status);
  const neg = await c1.c.req("GET", "/issues?page=-5&limit=99999");
  check("page=-5&limit=99999 is clamped", neg.status === 200 && neg.data?.page === 1 && neg.data?.limit <= 50, { status: neg.status, page: neg.data?.page, limit: neg.data?.limit });
  check("Audit page=1e20 does not crash", (await admin.req("GET", "/admin/audit?page=1e20")).status === 200);
  check("Made-up issue id gives 404", (await c1.c.req("GET", "/issues/not-an-id")).status === 404);
  check("Broken JSON gives 400", (await c1.c.req("POST", "/issues", "{not json")).status === 400);
  check("2 MB request gives 413", (await c1.c.req("PATCH", "/auth/me", JSON.stringify({ bio: "a".repeat(2_000_000) }))).status === 413);

  console.log("\n-- Files");
  const pdf = new Blob([Buffer.from("%PDF-1.4\n%a PDF pretending to be a photo\n")], { type: "image/jpeg" });
  check("PDF renamed to .jpg is refused", (await c1.c.req("POST", "/vision/classify", form({ image: pdf }))).status === 400);
  check("6 MB photo is refused", (await c1.c.req("POST", "/vision/classify", form({ image: new Blob([new Uint8Array(6 * 1024 * 1024)], { type: "image/jpeg" }) }))).status === 400);
  check("GIF is refused", (await c1.c.req("POST", "/vision/classify", form({ image: new Blob([Buffer.from("GIF89a......")], { type: "image/gif" }) }))).status === 400);
  check("SVG avatar is refused", (await c1.c.req("POST", "/auth/me/avatar", form({ avatar: new Blob([Buffer.from("<svg onload=alert(1)>")], { type: "image/svg+xml" }) }))).status === 400);

  console.log("\n-- Two things at once");
  const c3 = await citizen(3);
  const twice = await Promise.all([report(c3.c, "streetlight", 3), report(c3.c, "streetlight", 3)]);
  const codes = twice.map((t) => t.status).sort();
  check("Double-click Submit makes one report", codes[0] === 201 && (codes[1] === 429 || codes[1] === 409), codes);
  const i2 = await report(c2.c, "drainage", 4);
  const id2 = i2.data?.issue?.id as string;
  await admin.req("PATCH", `/issues/${id2}/assign`, { officerId: o2.id });
  const both = await Promise.all([o2.c.req("PATCH", `/issues/${id2}/status`, { status: "in_progress" }), admin.req("PATCH", `/issues/${id2}/status`, { status: "in_progress" })]);
  const after = await admin.req("GET", `/issues/${id2}`);
  const starts = (after.data?.issue?.timeline ?? []).filter((t: { status: string }) => t.status === "in_progress").length;
  check("Officer and admin starting work at once: only one succeeds", both.filter((b) => b.status === 200).length === 1 && starts === 1, { codes: both.map((b) => b.status), timelineEntries: starts });

  console.log("\n-- People");
  const i3 = await report(c2.c, "fallen_tree", 5);
  const id3 = i3.data?.issue?.id as string;
  await admin.req("PATCH", `/issues/${id3}/assign`, { officerId: o1.id });
  await admin.req("PATCH", `/admin/users/${o1.id}`, { isActive: false });
  const a3 = await admin.req("GET", `/issues/${id3}`);
  check("Deactivated officer's open issues are handed over", a3.data?.issue?.assignedTo?.id !== o1.id, a3.data?.issue?.assignedTo);
  check("Deactivated officer is logged out", (await o1.c.req("GET", "/auth/me")).status === 401);
  check("Cannot assign to a deactivated officer", (await admin.req("PATCH", `/issues/${id3}/assign`, { officerId: o1.id })).status === 404);
  const i4 = await report(c3.c, "garbage", 6);
  const id4 = i4.data?.issue?.id as string;
  await admin.req("PATCH", `/issues/${id4}/assign`, { officerId: o2.id });
  await admin.req("PATCH", `/admin/users/${o2.id}`, { role: "citizen" });
  const a4 = await admin.req("GET", `/issues/${id4}`);
  check("Officer changed to citizen: open issues are handed over", Boolean(id4) && a4.data?.issue?.assignedTo?.id !== o2.id, a4.data?.issue?.assignedTo);
  const adminId = (await admin.req("GET", "/auth/me")).data?.user?.id;
  check("Admin cannot deactivate themselves", (await admin.req("PATCH", `/admin/users/${adminId}`, { isActive: false })).status === 400);

  console.log("\n-- Passwords");
  const c4 = await citizen(4);
  const otherDevice = client();
  await otherDevice.req("POST", "/auth/login", { email: c4.email, password: "Citizen123" });
  check("Password change works", (await c4.c.req("PATCH", "/auth/me/password", { currentPassword: "Citizen123", newPassword: "Citizen456" })).status === 200);
  check("This device stays logged in", (await c4.c.req("GET", "/auth/me")).status === 200);
  check("Other devices are logged out", (await otherDevice.req("GET", "/auth/me")).status === 401);
}

// Everything this script made: users on the test domain, their reports, comments, alerts and log lines.
async function cleanUp() {
  await mongoose.connect(env.MONGODB_URI);
  const users = await User.find({ email: { $regex: `@${DOMAIN.replace(/\./g, "\\.")}$` } }).select("_id").lean();
  const userIds = users.map((u) => u._id as Types.ObjectId);
  const issues = await Issue.find({ "reports.user": { $in: userIds } }).select("_id").lean();
  const issueIds = issues.map((i) => i._id as Types.ObjectId);
  const ids = [...userIds, ...issueIds].map(String);
  await Promise.all([
    Comment.deleteMany({ $or: [{ issue: { $in: issueIds } }, { user: { $in: userIds } }] }),
    Notification.deleteMany({ $or: [{ issue: { $in: issueIds } }, { user: { $in: userIds } }] }),
    Flag.deleteMany({ $or: [{ issue: { $in: issueIds } }, { user: { $in: userIds } }] }),
    AuditLog.deleteMany({ $or: [{ targetId: { $in: ids } }, { actor: { $in: userIds } }] }),
  ]);
  await Issue.deleteMany({ _id: { $in: issueIds } });
  await User.deleteMany({ _id: { $in: userIds } });
  await mongoose.disconnect();
  console.log(`\nCleaned up ${userIds.length} test accounts and ${issueIds.length} test reports.`);
}

attack()
  .catch((err) => {
    console.error("The attack run stopped:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    console.log(`\n${passed} passed, ${failed.length} failed${failed.length ? `:\n - ${failed.join("\n - ")}` : ""}`);
    if (failed.length) process.exitCode = 1;
    await cleanUp().catch((err) => console.error("Clean-up failed:", (err as Error).message));
  });
