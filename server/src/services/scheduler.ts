import { Types } from "mongoose";
import { CATEGORIES, Issue, OPEN_STATUSES } from "../models/Issue";
import { issueName } from "../utils/labels";
import { audit, SYSTEM } from "./audit";
import { adminIds, broadcast, notify } from "./notify";
import { dueFrom, slaHoursFor } from "./sla";

const HOUR = 3_600_000;
// An issue nobody has picked up for this long is raised to the admins.
const UNASSIGNED_ALERT_HOURS = 12;

let running = false;

/**
 * The part of CiviConnect that acts on its own. Every minute it:
 *  1. gives older issues a fix-by time if they have none,
 *  2. warns the assigned officer when less than a quarter of the time is left,
 *  3. escalates overdue issues: timeline entry, priority boost, officer + admins told,
 *  4. tells admins about issues still unassigned after 12 hours.
 */
export async function runSweep(now = new Date()) {
  if (running) return;
  running = true;
  try {
    // 1. Backfill fix-by times.
    const missing = await Issue.find({ status: { $in: OPEN_STATUSES }, slaDueAt: null }).select("category createdAt").limit(1000).lean();
    if (missing.length) {
      await Issue.bulkWrite(
        missing.map((m) => ({
          updateOne: { filter: { _id: m._id }, update: { $set: { slaDueAt: dueFrom(m.category, new Date(m.createdAt)) } } },
        })),
      );
    }

    // 2. Warnings, per category because each has its own allowed time.
    for (const category of CATEGORIES) {
      const quarter = slaHoursFor(category) * 0.25 * HOUR;
      const soon = await Issue.find({
        category,
        status: { $in: OPEN_STATUSES },
        assignedTo: { $ne: null },
        slaWarnedAt: null,
        escalatedAt: null,
        slaDueAt: { $gt: now, $lte: new Date(now.getTime() + quarter) },
      }).limit(200);
      for (const issue of soon) {
        issue.slaWarnedAt = now;
        await issue.save({ timestamps: false });
        const hoursLeft = Math.max(1, Math.round((issue.slaDueAt!.getTime() - now.getTime()) / HOUR));
        await notify([issue.assignedTo!], {
          type: "sla_warning",
          title: `${hoursLeft} h left to fix ${issueName(issue)}`,
          body: issue.address ?? undefined,
          issueId: issue.id,
          category: issue.category,
        });
      }
    }

    // 3. Escalations.
    const overdue = await Issue.find({ status: { $in: OPEN_STATUSES }, escalatedAt: null, slaDueAt: { $lt: now } }).limit(200);
    const admins = overdue.length ? await adminIds() : [];
    for (const issue of overdue) {
      issue.escalatedAt = now;
      issue.lastActivityAt = now;
      issue.timeline.push({
        status: issue.status,
        note: `Escalated automatically: the ${slaHoursFor(issue.category)}-hour fix-by time has passed. Priority raised.`,
        images: [],
        byName: "CiviConnect",
        at: now,
      });
      await issue.save({ timestamps: false });
      const name = issueName(issue);
      await notify([...admins, ...(issue.assignedTo ? [issue.assignedTo] : [])], {
        type: "escalated",
        title: `Overdue: ${name}`,
        body: issue.assignedTo ? "The fix-by time passed. Priority was raised." : "The fix-by time passed and nobody is assigned.",
        issueId: issue.id,
        category: issue.category,
      });
      await audit(SYSTEM, "issue.escalated", { type: "issue", id: issue.id }, `${name} escalated after missing its fix-by time`);
    }

    // 4. Unassigned for too long.
    const waiting = await Issue.find({
      status: "reported",
      assignedTo: null,
      unassignedAlertAt: null,
      createdAt: { $lt: new Date(now.getTime() - UNASSIGNED_ALERT_HOURS * HOUR) },
    }).limit(100);
    if (waiting.length) {
      const ids = await adminIds();
      for (const issue of waiting) {
        issue.unassignedAlertAt = now;
        await issue.save({ timestamps: false });
      }
      await notify(ids, {
        type: "unassigned",
        title: waiting.length === 1 ? `${issueName(waiting[0])} is still unassigned` : `${waiting.length} issues are waiting for an officer`,
        body: `Reported more than ${UNASSIGNED_ALERT_HOURS} hours ago. Open the Command Center to assign them.`,
        link: "/dashboard",
        issueId: waiting.length === 1 ? waiting[0].id : undefined,
      });
    }

    if (overdue.length || waiting.length) broadcast(await adminIds(), "refresh", { reason: "sweep" });
  } catch (err) {
    console.warn("SLA sweep failed:", (err as Error).message);
  } finally {
    running = false;
  }
}

export function startScheduler(everyMs = 60_000) {
  setTimeout(() => void runSweep(), 5_000);
  return setInterval(() => void runSweep(), everyMs);
}

export const toObjectId = (id: string) => new Types.ObjectId(id);
