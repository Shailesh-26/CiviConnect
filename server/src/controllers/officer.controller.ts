import type { RequestHandler } from "express";
import { setLeave } from "../services/leave";
import { toPublicUser } from "../utils/publicUser";
import type { LeaveInput } from "../validators/admin.schemas";
import { Types } from "mongoose";
import { Issue, OPEN_STATUSES } from "../models/Issue";
import { toIssueDTO, type IssueRecord } from "../utils/issueDto";

const assigneeFields = { path: "assignedTo", select: "name department" };
const DAY = 86_400_000;

// Everything an officer needs for the day: open work by time left, and how they are doing.
export const desk: RequestHandler = async (req, res) => {
  const me = new Types.ObjectId(req.user!.id);
  const now = Date.now();
  const [open, recent, stats] = await Promise.all([
    Issue.find({ assignedTo: me, status: { $in: OPEN_STATUSES } }).populate(assigneeFields).lean() as unknown as Promise<IssueRecord[]>,
    Issue.find({ assignedTo: me, status: "resolved" }).sort({ resolvedAt: -1 }).limit(5).populate(assigneeFields).lean() as unknown as Promise<IssueRecord[]>,
    Issue.aggregate([
      { $match: { assignedTo: me, status: "resolved", resolvedAt: { $gte: new Date(now - 90 * DAY) } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          week: { $sum: { $cond: [{ $gte: ["$resolvedAt", new Date(now - 7 * DAY)] }, 1, 0] } },
          avgMs: { $avg: { $subtract: ["$resolvedAt", "$createdAt"] } },
          onTime: { $sum: { $cond: [{ $and: [{ $ne: ["$slaDueAt", null] }, { $lte: ["$resolvedAt", "$slaDueAt"] }] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const queue = open.map((r) => toIssueDTO(r, req.user!.id)).sort((a, b) => a.sla.hoursLeft - b.sla.hoursLeft);
  const s = stats[0];
  res.json({
    stats: {
      open: queue.length,
      breached: queue.filter((q) => q.sla.state === "breached").length,
      dueToday: queue.filter((q) => q.sla.state !== "breached" && q.sla.hoursLeft <= 24).length,
      inProgress: queue.filter((q) => q.status === "in_progress").length,
      resolvedWeek: s?.week ?? 0,
      resolved90d: s?.total ?? 0,
      avgFixHours: s ? Math.round((s.avgMs / 3_600_000) * 10) / 10 : null,
      onTimeRate: s?.total ? Math.round((s.onTime / s.total) * 100) : null,
    },
    queue,
    recent: recent.map((r) => toIssueDTO(r, req.user!.id)),
  });
};

// An officer marks themselves on leave (or back). Open work is handed to colleagues automatically.
export const setMyLeave: RequestHandler = async (req, res) => {
  const { onLeave, leaveUntil } = req.body as LeaveInput;
  const { officer, moved, back } = await setLeave(req.user!.id, onLeave, leaveUntil ?? null, req.user!);
  res.json({ user: officer ? toPublicUser(officer) : null, moved, back });
};
