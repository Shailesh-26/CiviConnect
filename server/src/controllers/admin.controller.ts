import type { RequestHandler } from "express";
import { isValidObjectId, Types } from "mongoose";
import { AuditLog } from "../models/AuditLog";
import { CategoryConfig } from "../models/CategoryConfig";
import { Comment } from "../models/Comment";
import { Flag } from "../models/Flag";
import { CATEGORIES, Issue, OPEN_STATUSES, type Category } from "../models/Issue";
import { User } from "../models/User";
import { audit } from "../services/audit";
import { broadcast, adminIds } from "../services/notify";
import { setSlaHours, slaHoursFor, slaTable } from "../services/sla";
import { AppError } from "../utils/AppError";
import { toIssueDTO, type IssueRecord } from "../utils/issueDto";
import { hashPassword } from "../utils/password";
import { toAdminUser } from "../utils/publicUser";
import type { CreateOfficerInput } from "../validators/auth.schemas";
import type { CategoryInput, ModerationInput, UpdateUserInput } from "../validators/admin.schemas";

const assigneeFields = { path: "assignedTo", select: "name department" };

// ---------------------------------------------------------------- People

export const listUsers: RequestHandler = async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(500);
  const counts = await Issue.aggregate([{ $unwind: "$reports" }, { $group: { _id: "$reports.user", n: { $sum: 1 } } }]);
  const reportsBy = new Map(counts.map((c) => [String(c._id), c.n as number]));
  res.json({
    users: users.map((user) => ({ ...toAdminUser(user), isActive: user.isActive, reportCount: reportsBy.get(user.id) ?? 0 })),
  });
};

export const createOfficer: RequestHandler = async (req, res) => {
  const { name, email, password, department } = req.body as CreateOfficerInput;

  if (await User.exists({ email })) {
    throw new AppError(409, "An account with this email already exists");
  }

  const user = await User.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: "officer",
    department,
  });
  await audit(req.user!, "user.created", { type: "user", id: user.id }, `Officer account created for ${name} (${department})`);

  res.status(201).json({ user: { ...toAdminUser(user), isActive: true, reportCount: 0 } });
};

export const updateUser: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  const input = req.body as UpdateUserInput;
  if (!isValidObjectId(id)) throw new AppError(404, "User not found");
  if (id === req.user!.id && (input.isActive === false || (input.role && input.role !== "admin"))) {
    throw new AppError(400, "You cannot deactivate yourself or remove your own admin role");
  }
  const user = await User.findById(id);
  if (!user) throw new AppError(404, "User not found");

  const changes: string[] = [];
  if (input.role && input.role !== user.role) {
    if (input.role === "officer" && !(input.department ?? user.department)) {
      throw new AppError(400, "Give the officer a department", { errors: [{ field: "department", message: "Department is required for officers" }] });
    }
    changes.push(`role ${user.role} → ${input.role}`);
    user.role = input.role;
  }
  if (input.department !== undefined && input.department !== (user.department ?? "")) {
    changes.push(`department → ${input.department || "none"}`);
    user.department = input.department || undefined;
  }
  if (input.isActive !== undefined && input.isActive !== user.isActive) {
    changes.push(input.isActive ? "reactivated" : "deactivated");
    user.isActive = input.isActive;
  }
  await user.save();
  if (changes.length) await audit(req.user!, "user.updated", { type: "user", id }, `${user.name}: ${changes.join(", ")}`);

  res.json({ user: { ...toAdminUser(user), isActive: user.isActive } });
};

// ---------------------------------------------------------------- Command Center

// Words that link an officer's department to a category, used for smart routing.
const DEPT_HINTS: Record<Category, string[]> = {
  pothole: ["road", "pave", "engineer"],
  garbage: ["sanit", "waste", "garbage", "clean"],
  drainage: ["drain", "sewer", "water"],
  streetlight: ["light", "electric"],
  fallen_tree: ["tree", "park", "horti", "green"],
  other: ["road", "general", "ward"],
};

type OfficerLite = { _id: Types.ObjectId; name: string; department?: string | null };

/**
 * Suggest who should take an issue: experience with the category (past assignments),
 * a department that matches, and spare capacity (fewer open issues). Weights are simple and visible.
 */
function suggest(category: Category, officers: OfficerLite[], history: Map<string, number>, load: Map<string, number>) {
  let best: { officer: OfficerLite; score: number } | null = null;
  for (const o of officers) {
    const id = o._id.toString();
    const dept = (o.department ?? "").toLowerCase();
    const match = DEPT_HINTS[category].some((h) => dept.includes(h)) ? 5 : 0;
    const score = (history.get(`${id}:${category}`) ?? 0) + match - 1.5 * (load.get(id) ?? 0);
    if (!best || score > best.score) best = { officer: o, score };
  }
  if (!best) return null;
  const id = best.officer._id.toString();
  return {
    id,
    name: best.officer.name,
    reason: `${best.officer.department ?? "Officer"} · ${load.get(id) ?? 0} open`,
  };
}

export const overview: RequestHandler = async (req, res) => {
  const viewer = req.user!.id;
  const now = Date.now();
  const [open, officers, history, resolved7d, flagsOpen, activity, resolvedByOfficer] = await Promise.all([
    Issue.find({ status: { $in: OPEN_STATUSES } }).populate(assigneeFields).lean() as unknown as Promise<IssueRecord[]>,
    User.find({ role: "officer", isActive: true }).select("name department avatar").lean(),
    Issue.aggregate([{ $match: { assignedTo: { $ne: null } } }, { $group: { _id: { o: "$assignedTo", c: "$category" }, n: { $sum: 1 } } }]),
    Issue.countDocuments({ status: "resolved", resolvedAt: { $gte: new Date(now - 7 * 86_400_000) } }),
    Flag.countDocuments({ status: "open" }),
    AuditLog.find().sort({ createdAt: -1 }).limit(12).lean(),
    Issue.aggregate([
      { $match: { status: "resolved", resolvedAt: { $gte: new Date(now - 30 * 86_400_000) }, assignedTo: { $ne: null } } },
      { $group: { _id: "$assignedTo", n: { $sum: 1 }, avgMs: { $avg: { $subtract: ["$resolvedAt", "$createdAt"] } } } },
    ]),
  ]);

  const dtos = open.map((r) => toIssueDTO(r, viewer));
  const historyMap = new Map(history.map((h) => [`${h._id.o}:${h._id.c}`, h.n as number]));
  const load = new Map<string, number>();
  for (const d of dtos) if (d.assignedTo) load.set(d.assignedTo.id, (load.get(d.assignedTo.id) ?? 0) + 1);
  const resolvedMap = new Map(resolvedByOfficer.map((r) => [String(r._id), r]));

  const unassigned = dtos
    .filter((d) => !d.assignedTo)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 60)
    .map((d) => ({ ...d, suggestion: suggest(d.category, officers as OfficerLite[], historyMap, load) }));

  const byDue = (a: (typeof dtos)[number], b: (typeof dtos)[number]) => a.sla.hoursLeft - b.sla.hoursLeft;

  res.json({
    kpis: {
      open: dtos.length,
      unassigned: dtos.filter((d) => !d.assignedTo).length,
      breached: dtos.filter((d) => d.sla.state === "breached").length,
      dueSoon: dtos.filter((d) => d.sla.state !== "breached" && d.sla.hoursLeft <= 24).length,
      highPriority: dtos.filter((d) => d.priorityLabel === "high").length,
      resolved7d,
      flagsOpen,
    },
    breachBoard: dtos.filter((d) => d.sla.state === "breached" || d.sla.state === "warning").sort(byDue).slice(0, 12),
    unassigned,
    lanes: officers.map((o) => {
      const id = o._id.toString();
      const mine = dtos.filter((d) => d.assignedTo?.id === id).sort(byDue);
      const r = resolvedMap.get(id);
      return {
        officer: {
          id,
          name: o.name,
          department: o.department ?? null,
          avatar: o.avatar && (o.avatar.url || o.avatar.emoji) ? { emoji: o.avatar.emoji ?? null, color: o.avatar.color ?? null, url: o.avatar.url ?? null } : null,
        },
        open: mine.length,
        breached: mine.filter((d) => d.sla.state === "breached").length,
        resolved30d: r?.n ?? 0,
        avgFixHours: r ? Math.round((r.avgMs / 3_600_000) * 10) / 10 : null,
        issues: mine.slice(0, 25),
      };
    }),
    pins: dtos.map((d) => ({
      id: d.id,
      ticket: d.ticket,
      category: d.category,
      customIcon: d.customIcon,
      customLabel: d.customLabel,
      status: d.status,
      priorityLabel: d.priorityLabel,
      slaState: d.sla.state,
      assigned: Boolean(d.assignedTo),
      location: d.location,
    })),
    activity: activity.map((a) => ({
      id: a._id.toString(),
      actorName: a.actorName,
      actorRole: a.actorRole,
      action: a.action,
      summary: a.summary,
      targetType: a.targetType,
      targetId: a.targetId ?? null,
      at: a.createdAt,
    })),
  });
};

// ---------------------------------------------------------------- Moderation

type FlagGroup = {
  _id: { t: "issue" | "comment"; id: Types.ObjectId };
  count: number;
  reasons: string[];
  notes: (string | null)[];
  issue: Types.ObjectId;
  firstAt: Date;
  lastAt: Date;
};

export const listFlags: RequestHandler = async (req, res) => {
  const status = req.query.status === "closed" ? { $in: ["dismissed", "actioned"] } : "open";
  const groups = (await Flag.aggregate([
    { $match: { status } },
    {
      $group: {
        _id: { t: "$targetType", id: "$target" },
        count: { $sum: 1 },
        reasons: { $push: "$reason" },
        notes: { $push: "$note" },
        issue: { $first: "$issue" },
        firstAt: { $min: "$createdAt" },
        lastAt: { $max: "$createdAt" },
      },
    },
    { $sort: { count: -1, lastAt: -1 } },
    { $limit: 100 },
  ])) as FlagGroup[];

  const issueIds = groups.map((g) => g.issue);
  const commentIds = groups.filter((g) => g._id.t === "comment").map((g) => g._id.id);
  const [issues, comments] = await Promise.all([
    Issue.find({ _id: { $in: issueIds } }).select("ticket category customLabel customIcon status address reports").lean(),
    Comment.find({ _id: { $in: commentIds } }).populate("user", "name").lean(),
  ]);
  const issueMap = new Map(issues.map((i) => [i._id.toString(), i]));
  const commentMap = new Map(comments.map((c) => [c._id.toString(), c]));

  res.json({
    groups: groups.map((g) => {
      const issue = issueMap.get(g.issue.toString());
      const comment = g._id.t === "comment" ? commentMap.get(g._id.id.toString()) : undefined;
      const reasonCounts: Record<string, number> = {};
      for (const r of g.reasons) reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
      return {
        targetType: g._id.t,
        targetId: g._id.id.toString(),
        count: g.count,
        reasons: reasonCounts,
        notes: g.notes.filter(Boolean),
        firstAt: g.firstAt,
        lastAt: g.lastAt,
        issue: issue
          ? {
              id: issue._id.toString(),
              ticket: issue.ticket,
              category: issue.category,
              customLabel: issue.customLabel ?? null,
              customIcon: issue.customIcon ?? null,
              status: issue.status,
              address: issue.address ?? null,
              description: issue.reports[0]?.description ?? "",
            }
          : null,
        comment: comment
          ? {
              body: comment.body ?? null,
              author: (comment.user as unknown as { name?: string } | null)?.name ?? "Someone",
              hidden: comment.hidden,
              deleted: comment.deleted,
            }
          : null,
      };
    }),
  });
};

export const resolveFlags: RequestHandler = async (req, res) => {
  const { targetType, targetId, action } = req.body as ModerationInput;
  const target = new Types.ObjectId(targetId);
  const open = await Flag.find({ targetType, target, status: "open" });
  if (open.length === 0) throw new AppError(404, "Nothing to review here any more");
  const reasons = [...new Set(open.map((f) => f.reason.replace("_", " ")))].join(", ");

  if (targetType === "comment") {
    const comment = await Comment.findById(target);
    if (comment) {
      if (action === "remove") {
        comment.deleted = true;
        comment.body = undefined;
        comment.images.splice(0, comment.images.length);
        await Issue.updateOne({ _id: comment.issue, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } });
      } else {
        comment.hidden = false;
      }
      await comment.save();
    }
  } else {
    const issue = await Issue.findById(target);
    if (issue) {
      if (action === "remove" && issue.status !== "rejected") {
        issue.status = "rejected";
        issue.resolvedAt = undefined;
        issue.timeline.push({
          status: "rejected",
          note: `Removed after moderation (reported as: ${reasons})`,
          images: [],
          by: new Types.ObjectId(req.user!.id),
          byName: req.user!.name,
          at: new Date(),
        });
      }
      issue.flagCount = 0;
      await issue.save();
    }
  }

  await Flag.updateMany({ targetType, target, status: "open" }, { status: action === "remove" ? "actioned" : "dismissed" });
  await audit(
    req.user!,
    action === "remove" ? "moderation.removed" : "moderation.dismissed",
    { type: targetType, id: targetId },
    `${action === "remove" ? "Removed" : "Kept"} a reported ${targetType} (${open.length} ${open.length === 1 ? "report" : "reports"}: ${reasons})`,
  );
  broadcast(await adminIds(), "refresh", { reason: "moderation" });
  res.json({ ok: true });
};

// ---------------------------------------------------------------- Categories & SLA

export const listCategories: RequestHandler = async (_req, res) => {
  const open = await Issue.aggregate([{ $match: { status: { $in: OPEN_STATUSES } } }, { $group: { _id: "$category", n: { $sum: 1 } } }]);
  const counts = new Map(open.map((o) => [o._id as string, o.n as number]));
  res.json({ categories: slaTable().map((row) => ({ ...row, open: counts.get(row.category) ?? 0 })) });
};

export const updateCategory: RequestHandler = async (req, res) => {
  const category = String(req.params.category) as Category;
  if (!(CATEGORIES as readonly string[]).includes(category)) throw new AppError(404, "Unknown category");
  const { slaHours } = req.body as CategoryInput;
  const before = slaHoursFor(category);

  await CategoryConfig.updateOne({ category }, { slaHours }, { upsert: true });
  setSlaHours(category, slaHours);

  // Open issues of this category get the new fix-by time, measured from when they were reported.
  const open = await Issue.find({ category, status: { $in: OPEN_STATUSES } }).select("createdAt escalatedAt");
  const now = Date.now();
  let cleared = 0;
  await Issue.bulkWrite(
    open.map((i) => {
      const due = new Date(new Date(i.createdAt).getTime() + slaHours * 3_600_000);
      const stillLate = due.getTime() < now;
      if (i.escalatedAt && !stillLate) cleared++;
      return {
        updateOne: {
          filter: { _id: i._id },
          update: stillLate ? { $set: { slaDueAt: due } } : { $set: { slaDueAt: due }, $unset: { escalatedAt: 1, slaWarnedAt: 1 } },
        },
      };
    }),
  );

  await audit(req.user!, "category.sla", { type: "category", id: category }, `Fix-by time for ${category.replace("_", " ")} changed from ${before} h to ${slaHours} h (${open.length} open issues updated)`);
  broadcast(await adminIds(), "refresh", { reason: "sla" });
  res.json({ category, slaHours, updated: open.length, deEscalated: cleared });
};

// ---------------------------------------------------------------- Audit log

export const listAudit: RequestHandler = async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (typeof req.query.action === "string" && /^[a-z_.]+$/.test(req.query.action)) filter.action = { $regex: `^${req.query.action}` };
  if (typeof req.query.before === "string" && !Number.isNaN(Date.parse(req.query.before))) filter.createdAt = { $lt: new Date(req.query.before) };
  const rows = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(60).lean();
  res.json({
    entries: rows.map((a) => ({
      id: a._id.toString(),
      actorName: a.actorName,
      actorRole: a.actorRole,
      action: a.action,
      summary: a.summary,
      targetType: a.targetType,
      targetId: a.targetId ?? null,
      at: a.createdAt,
    })),
    hasMore: rows.length === 60,
  });
};

