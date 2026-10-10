import { Types } from "mongoose";
import { Comment } from "../models/Comment";
import { CATEGORIES, Issue, OPEN_STATUSES, type Category } from "../models/Issue";
import { User } from "../models/User";
import { issueName } from "../utils/labels";
import { audit } from "./audit";
import { adminIds, broadcast, notify } from "./notify";
import { dueFrom } from "./sla";

/**
 * Live demo simulator (admin only). While running, it plays the part of the demo city's
 * citizens, admin and officers: new reports, upvotes, assignments, work starting, fixes and
 * comments. Everything goes through the same notifications and live updates as real actions.
 * It only ever touches demo accounts (@civiconnect.demo) and demo issues (tickets CC-D…).
 */

const DEMO_EMAIL = /@civiconnect\.demo$/;
const DEMO_TICKET = /^CC-D(S?)\d{4}$/;

const TEXT: Record<Category, string[]> = {
  pothole: ["New pothole opened after last night's rain, bikes are swerving around it.", "Road has caved in near the speed breaker, about a foot deep."],
  garbage: ["Garbage pile is back at the corner and blocking the footpath.", "Bins overflowing since morning, stray dogs are scattering waste."],
  drainage: ["Drain is choked and water is spilling onto the road.", "Manhole is overflowing near the bus stop, smells terrible."],
  streetlight: ["Two street lights are off, the lane is completely dark.", "Light keeps flickering and switches off after 9 pm."],
  fallen_tree: ["A big branch fell on the footpath, people are walking on the road.", "Tree leaning dangerously over the parked cars after the wind."],
  other: ["Footpath slab broken and sticking up, elderly people are tripping.", "Signboard bent and blocking the view at the turn."],
};
const COMMENTS = ["Still there this evening.", "Same problem near my gate too, please hurry.", "Thanks for picking this up!", "It got worse after the rain today.", "Kids walk here to school, please fix soon."];
const FIXES = ["Repair done and the area cleared.", "Fixed and checked on site.", "Work completed, please confirm."];

type State = { running: boolean; everyMs: number; startedAt: Date | null; actions: number; last: string | null; timer: NodeJS.Timeout | null; seq: number };
const state: State = { running: false, everyMs: 8000, startedAt: null, actions: 0, last: null, timer: null, seq: 0 };

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export function simulatorStatus() {
  return { running: state.running, everySeconds: Math.round(state.everyMs / 1000), startedAt: state.startedAt, actions: state.actions, last: state.last };
}

async function demoUsers() {
  const users = await User.find({ email: DEMO_EMAIL, isActive: true }).select("name role department").lean();
  return {
    citizens: users.filter((u) => u.role === "citizen"),
    officers: users.filter((u) => u.role === "officer"),
    admin: users.find((u) => u.role === "admin"),
  };
}

const DEPT: Record<Category, string[]> = {
  pothole: ["road"], garbage: ["sanit"], drainage: ["drain"], streetlight: ["light"], fallen_tree: ["tree"], other: ["road", "sanit"],
};

async function tick() {
  const { citizens, officers, admin } = await demoUsers();
  if (!citizens.length || !officers.length || !admin) {
    stopSimulator();
    return;
  }
  const admins = await adminIds();
  const roll = Math.random();
  const demoOpen = { ticket: DEMO_TICKET, status: { $in: OPEN_STATUSES } };

  if (roll < 0.28) {
    // A citizen reports something new near the existing demo city.
    const anchor = await Issue.findOne({ ticket: DEMO_TICKET }).skip(Math.floor(Math.random() * 100)).select("location address").lean();
    const coords = anchor?.location?.coordinates;
    if (!anchor || !coords) return;
    const category = pick([...CATEGORIES]);
    const citizen = pick(citizens);
    const [lng, lat] = coords;
    const now = new Date();
    state.seq = (state.seq + 1) % 10000;
    const issue = await Issue.create({
      ticket: `CC-DS${String(state.seq).padStart(4, "0")}`,
      category,
      customLabel: category === "other" ? "Broken footpath" : undefined,
      customLabelKey: category === "other" ? "broken footpath" : undefined,
      customIcon: category === "other" ? "footprints" : undefined,
      address: anchor.address ?? undefined,
      location: { type: "Point", coordinates: [lng + (Math.random() - 0.5) * 0.008, lat + (Math.random() - 0.5) * 0.008] },
      reports: [{ user: citizen._id, description: pick(TEXT[category]), images: [] }],
      timeline: [{ status: "reported", note: "Issue reported", by: citizen._id, byName: citizen.name, at: now }],
      followers: [citizen._id],
      lastActivityAt: now,
      slaDueAt: dueFrom(category, now),
    });
    await notify(admins, { type: "new_issue", title: `New report: ${issueName(issue)}`, body: issue.address ?? undefined, issueId: issue.id, category });
    state.last = `${citizen.name} reported ${issueName(issue)}`;
  } else if (roll < 0.43) {
    // Neighbours upvote.
    const issue = await Issue.findOne(demoOpen).skip(Math.floor(Math.random() * 30));
    const citizen = pick(citizens);
    if (!issue || issue.supporters.some((s) => s.equals(citizen._id))) return;
    issue.supporters.push(citizen._id);
    issue.lastActivityAt = new Date();
    await issue.save();
    state.last = `${citizen.name} upvoted ${issueName(issue)}`;
  } else if (roll < 0.6) {
    // The admin assigns an unassigned issue to a matching officer.
    const issue = await Issue.findOne({ ticket: DEMO_TICKET, status: "reported", assignedTo: null }).sort({ createdAt: 1 });
    if (!issue) return;
    const officer = officers.find((o) => DEPT[issue.category].some((d) => (o.department ?? "").toLowerCase().includes(d))) ?? pick(officers);
    issue.assignedTo = officer._id;
    issue.status = "acknowledged";
    issue.lastActivityAt = new Date();
    issue.timeline.push({ status: "acknowledged", note: `Assigned to ${officer.name}${officer.department ? ` (${officer.department})` : ""}`, by: admin._id, byName: admin.name, at: new Date() });
    await issue.save();
    await notify([officer._id], { type: "assigned", title: `New assignment: ${issueName(issue)}`, body: issue.address ?? undefined, issueId: issue.id, category: issue.category });
    await notify(issue.followers, { type: "status", title: `${issueName(issue)} was picked up`, body: `${officer.name} is now responsible for it.`, issueId: issue.id, category: issue.category });
    await audit({ id: admin._id.toString(), name: admin.name, role: "admin" }, "issue.assigned", { type: "issue", id: issue.id }, `${issueName(issue)} assigned to ${officer.name} (simulator)`);
    state.last = `${admin.name} assigned ${issueName(issue)} to ${officer.name}`;
  } else if (roll < 0.74) {
    // An officer starts work.
    const issue = await Issue.findOne({ ticket: DEMO_TICKET, status: "acknowledged", assignedTo: { $ne: null } }).populate("assignedTo", "name");
    if (!issue) return;
    const officer = issue.assignedTo as unknown as { _id: Types.ObjectId; name: string };
    issue.status = "in_progress";
    issue.lastActivityAt = new Date();
    issue.timeline.push({ status: "in_progress", note: "Crew has been sent to the site.", by: officer._id, byName: officer.name, at: new Date() });
    issue.assignedTo = officer._id;
    await issue.save();
    await notify(issue.followers, { type: "status", title: `${issueName(issue)} is now in progress`, body: "Crew has been sent to the site.", issueId: issue.id, category: issue.category });
    await audit({ id: officer._id.toString(), name: officer.name, role: "officer" }, "issue.in_progress", { type: "issue", id: issue.id }, `${issueName(issue)}: Acknowledged → In progress (simulator)`);
    state.last = `${officer.name} started work on ${issueName(issue)}`;
  } else if (roll < 0.86) {
    // An officer fixes something, with a proof photo.
    const issue = await Issue.findOne({ ticket: DEMO_TICKET, status: "in_progress", assignedTo: { $ne: null } }).populate("assignedTo", "name");
    if (!issue) return;
    const officer = issue.assignedTo as unknown as { _id: Types.ObjectId; name: string };
    const slug = issue.category === "fallen_tree" ? "tree" : issue.category;
    issue.status = "resolved";
    issue.resolvedAt = new Date();
    issue.lastActivityAt = new Date();
    issue.verifications.splice(0, issue.verifications.length);
    issue.timeline.push({ status: "resolved", note: pick(FIXES), images: [{ url: `/demo/${slug}-after.svg`, publicId: `demo/${slug}-after` }], by: officer._id, byName: officer.name, at: new Date() });
    issue.assignedTo = officer._id;
    await issue.save();
    await notify(issue.followers, { type: "resolved", title: `Fixed: ${issueName(issue)}`, body: "Is it really fixed? Tap to confirm or say it is still there.", issueId: issue.id, category: issue.category });
    await audit({ id: officer._id.toString(), name: officer.name, role: "officer" }, "issue.resolved", { type: "issue", id: issue.id }, `${issueName(issue)}: In progress → Resolved (simulator)`);
    state.last = `${officer.name} fixed ${issueName(issue)}`;
  } else {
    // A neighbour comments.
    const issue = await Issue.findOne(demoOpen).skip(Math.floor(Math.random() * 30));
    const citizen = pick(citizens);
    if (!issue) return;
    const body = pick(COMMENTS);
    await Comment.create({ issue: issue._id, user: citizen._id, body, official: false });
    await Issue.updateOne({ _id: issue._id }, { $inc: { commentCount: 1 }, $set: { lastActivityAt: new Date() }, $addToSet: { followers: citizen._id } });
    await notify(issue.followers, { type: "comment", title: `New comment on ${issueName(issue)}`, body: `${citizen.name}: ${body}`, link: `/issues/${issue.id}#discussion`, issueId: issue.id, category: issue.category }, citizen._id.toString());
    state.last = `${citizen.name} commented on ${issueName(issue)}`;
  }

  state.actions++;
  broadcast(admins, "refresh", { reason: "simulator" });
  broadcast(admins, "simulator", simulatorStatus());
}

export async function startSimulator(everySeconds: number) {
  const { citizens, officers, admin } = await demoUsers();
  if (!citizens.length || !officers.length || !admin) throw new Error("Run `npm run seed:demo` first: the simulator only plays with the demo city.");
  stopSimulator();
  state.everyMs = Math.min(60, Math.max(3, everySeconds)) * 1000;
  state.running = true;
  state.startedAt = new Date();
  state.actions = 0;
  state.last = null;
  const loop = async () => {
    if (!state.running) return;
    try {
      await tick();
    } catch (err) {
      console.warn("Simulator step failed:", (err as Error).message);
    }
    if (state.running) state.timer = setTimeout(loop, state.everyMs * (0.6 + Math.random() * 0.8));
  };
  state.timer = setTimeout(loop, 1000);
  return simulatorStatus();
}

export function stopSimulator() {
  state.running = false;
  if (state.timer) clearTimeout(state.timer);
  state.timer = null;
  return simulatorStatus();
}
