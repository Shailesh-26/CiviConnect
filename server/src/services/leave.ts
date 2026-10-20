import { Types } from "mongoose";
import { Issue, OPEN_STATUSES } from "../models/Issue";
import { User } from "../models/User";
import { issueName } from "../utils/labels";
import { audit, SYSTEM, type Actor } from "./audit";
import { adminIds, broadcast, notify } from "./notify";
import { routingContext, suggest } from "./routing";

const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/**
 * Put an officer on leave (or bring them back). Going on leave hands every open issue to the best
 * available colleague (same smart routing as the Command Center). If nobody fits, the issue goes back
 * to the Unassigned lane so an admin can decide.
 */
type Moved = { ticket: string; to: string | null };
type Back = { returned: { ticket: string }[]; kept: { ticket: string; with: string | null; status: string }[] };
const noBack: Back = { returned: [], kept: [] };

export async function setLeave(officerId: string, on: boolean, until: Date | null, actor: Actor, reason?: string) {
  const officer = await User.findOne({ _id: officerId, role: "officer" });
  if (!officer) return { officer: null, moved: [] as Moved[], back: noBack };

  if (!on) {
    const wasOnLeave = Boolean(officer.onLeaveSince);
    officer.set("onLeaveSince", undefined);
    officer.set("onLeaveUntil", undefined);
    officer.set("onLeaveReason", undefined);
    await officer.save();
    const back = wasOnLeave ? await returnHandedOver(officer, actor) : noBack;
    if (wasOnLeave) {
      await audit(actor, "user.leave_ended", { type: "user", id: officer.id }, `${officer.name} is back from leave; ${back.returned.length} issues returned`, back);
      await notify(await adminIds(), {
        type: "leave",
        title: `${officer.name} is back`,
        body: back.returned.length ? `${back.returned.length} not-yet-started ${back.returned.length === 1 ? "issue went" : "issues went"} back to them.` : "New work can be assigned again.",
        link: "/dashboard",
      }, actor.id);
      broadcast(await adminIds(), "refresh", { reason: "leave" });
    }
    return { officer, moved: [] as Moved[], back };
  }

  officer.onLeaveSince = officer.onLeaveSince ?? new Date();
  officer.set("onLeaveUntil", until ?? undefined);
  if (reason) officer.set("onLeaveReason", reason);
  await officer.save();

  const open = await Issue.find({ assignedTo: officer._id, status: { $in: OPEN_STATUSES } });
  const ctx = await routingContext();
  const moved: { ticket: string; to: string | null }[] = [];
  const receivers = new Set<string>([officer.id]);
  const now = new Date();
  const byId = actor.id && Types.ObjectId.isValid(actor.id) ? new Types.ObjectId(actor.id) : undefined;

  for (const issue of open) {
    ctx.load.set(officer.id, Math.max(0, (ctx.load.get(officer.id) ?? 1) - 1));
    const pick = suggest(issue.category, ctx.officers.filter((o) => o._id.toString() !== officer.id), ctx.history, ctx.load);
    const name = issueName(issue);
    if (pick) {
      issue.assignedTo = new Types.ObjectId(pick.id);
      issue.handedOverFrom = officer._id;
      ctx.load.set(pick.id, (ctx.load.get(pick.id) ?? 0) + 1);
      receivers.add(pick.id);
      issue.timeline.push({ status: issue.status, note: `Reassigned to ${pick.name}: ${officer.name} is on leave`, images: [], by: byId, byName: actor.name, at: now });
      await notify([pick.id], { type: "assigned", title: `New assignment: ${name}`, body: `Handed over because ${officer.name} is on leave.`, issueId: issue.id, category: issue.category });
    } else {
      issue.set("assignedTo", undefined);
      issue.handedOverFrom = officer._id;
      issue.timeline.push({ status: issue.status, note: `Back in the unassigned queue: ${officer.name} is on leave`, images: [], by: byId, byName: actor.name, at: now });
    }
    issue.lastActivityAt = now;
    await issue.save();
    moved.push({ ticket: issue.ticket, to: pick?.name ?? null });
  }

  const handed = moved.filter((m) => m.to).length;
  const summary = `${officer.name} on leave${until ? ` until ${fmt(until)}` : ""}${reason ? ` (${reason})` : ""}; ${handed} of ${moved.length} open issues reassigned`;
  await audit(actor, "user.leave_started", { type: "user", id: officer.id }, summary, { moved });
  await notify(await adminIds(), {
    type: "leave",
    title: `${officer.name} is on leave${until ? ` until ${fmt(until)}` : ""}`,
    body: (reason ? `Reason: ${reason}. ` : "") + (moved.length ? `${handed} open ${handed === 1 ? "issue was" : "issues were"} handed to colleagues${moved.length - handed ? `, ${moved.length - handed} went back to Unassigned` : ""}.` : "No open issues needed to move."),
    link: "/dashboard",
  }, actor.id);
  broadcast([...(await adminIds()), ...receivers], "refresh", { reason: "leave" });
  return { officer, moved, back: noBack };
}

/**
 * Back from leave: issues that were handed over and not started yet come back to their original officer.
 * Work a colleague has already started (In progress) stays with them, so nobody's effort is wasted.
 */
async function returnHandedOver(officer: { _id: Types.ObjectId; id: string; name: string }, actor: Actor): Promise<Back> {
  const handed = await Issue.find({ handedOverFrom: officer._id }).populate<{ assignedTo: { _id: Types.ObjectId; name: string } | null }>("assignedTo", "name");
  const back: Back = { returned: [], kept: [] };
  const now = new Date();
  const byId = actor.id && Types.ObjectId.isValid(actor.id) ? new Types.ObjectId(actor.id) : undefined;
  for (const issue of handed) {
    const stillWaiting = OPEN_STATUSES.includes(issue.status) && issue.status !== "in_progress";
    const colleague = issue.assignedTo && !issue.assignedTo._id.equals(officer._id) ? issue.assignedTo : null;
    issue.set("handedOverFrom", undefined);
    if (stillWaiting) {
      issue.set("assignedTo", officer._id);
      if (issue.status === "reported") issue.status = "acknowledged";
      issue.timeline.push({ status: issue.status, note: `Returned to ${officer.name}, back from leave`, images: [], by: byId, byName: actor.name, at: now });
      issue.lastActivityAt = now;
      back.returned.push({ ticket: issue.ticket });
      if (colleague) {
        await notify([colleague._id], { type: "unassigned", title: `${issueName(issue)} went back to ${officer.name}`, body: `${officer.name} is back from leave. Thanks for covering.`, issueId: issue.id, category: issue.category });
      }
    } else {
      back.kept.push({ ticket: issue.ticket, with: colleague?.name ?? null, status: issue.status });
    }
    await issue.save();
  }
  return back;
}

// Called by the scheduler: leave with an end date that has passed ends automatically.
export async function endExpiredLeave(now = new Date()) {
  const due = await User.find({ role: "officer", onLeaveSince: { $ne: null }, onLeaveUntil: { $lte: now } }).select("_id name");
  for (const o of due) {
    await setLeave(o.id, false, null, SYSTEM);
    await notify([o._id], { type: "leave", title: "Welcome back", body: "Your leave has ended. New assignments will reach you again.", link: "/dashboard" });
  }
}
