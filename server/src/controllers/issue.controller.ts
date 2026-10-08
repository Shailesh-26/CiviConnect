import type { RequestHandler } from "express";
import { isValidObjectId, Types } from "mongoose";
import { CATEGORIES, Issue, OPEN_STATUSES, STATUSES, type Status } from "../models/Issue";
import { User } from "../models/User";
import { AppError } from "../utils/AppError";
import { imageStorageEnabled, uploadImage } from "../utils/cloudinary";
import { toIssueDetailDTO, toIssueDTO, type IssueRecord } from "../utils/issueDto";
import type { AssignInput, CreateIssueInput, StatusInput, VerifyInput } from "../validators/issue.schemas";

// Reports of the same category closer than this are merged into one master issue.
const MERGE_RADIUS_METERS = 50;

const TRANSITIONS: Record<Status, Status[]> = {
  reported: ["acknowledged", "rejected"],
  acknowledged: ["in_progress", "rejected"],
  in_progress: ["resolved", "rejected"],
  resolved: ["in_progress"],
  rejected: [],
};

const assigneeFields = { path: "assignedTo", select: "name department" };

function newTicket() {
  const time = Date.now().toString(36).toUpperCase().slice(-6);
  const salt = Math.floor(Math.random() * 36).toString(36).toUpperCase();
  return `CC-${time}${salt}`;
}

async function loadRecord(id: string) {
  if (!isValidObjectId(id)) throw new AppError(404, "Issue not found");
  const record = (await Issue.findById(id).populate(assigneeFields).lean()) as unknown as IssueRecord | null;
  if (!record) throw new AppError(404, "Issue not found");
  return record;
}

async function loadList(filter: Record<string, unknown>, viewerId: string, byPriority = true) {
  const records = (await Issue.find(filter)
    .populate(assigneeFields)
    .sort({ createdAt: -1 })
    .limit(300)
    .lean()) as unknown as IssueRecord[];
  const issues = records.map((r) => toIssueDTO(r, viewerId));
  return byPriority ? issues.sort((a, b) => b.priority - a.priority) : issues;
}

export const createIssue: RequestHandler = async (req, res) => {
  const user = req.user!;
  const { category, description, lat, lng, address } = req.body as CreateIssueInput;
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];

  if (files.length > 0 && !imageStorageEnabled) {
    throw new AppError(503, "Photo upload is not set up on the server yet");
  }

  const point = { type: "Point" as const, coordinates: [lng, lat] };
  const userId = new Types.ObjectId(user.id);

  const nearby = await Issue.findOne({
    category,
    status: { $in: OPEN_STATUSES },
    location: { $near: { $geometry: point, $maxDistance: MERGE_RADIUS_METERS } },
  });

  if (nearby?.reports.some((r) => r.user.equals(userId))) {
    throw new AppError(409, `You already reported this problem (${nearby.ticket})`);
  }

  const images = await Promise.all(files.map((f) => uploadImage(f.buffer)));

  let issueId: string;
  let merged = false;

  if (nearby) {
    nearby.reports.push({ user: userId, description, images });
    await nearby.save();
    issueId = nearby.id;
    merged = true;
  } else {
    const created = await Issue.create({
      ticket: newTicket(),
      category,
      address: address || undefined,
      location: point,
      reports: [{ user: userId, description, images }],
      timeline: [{ status: "reported", note: "Issue reported", by: userId, byName: user.name }],
    });
    issueId = created.id;
  }

  const record = await loadRecord(issueId);
  res.status(merged ? 200 : 201).json({ merged, issue: toIssueDetailDTO(record, user.id) });
};

export const listIssues: RequestHandler = async (req, res) => {
  const filter: Record<string, unknown> = {};
  const { status, category } = req.query;
  if (typeof status === "string" && (STATUSES as readonly string[]).includes(status)) filter.status = status;
  if (typeof category === "string" && (CATEGORIES as readonly string[]).includes(category)) {
    filter.category = category;
  }
  res.json({ issues: await loadList(filter, req.user!.id) });
};

export const listMine: RequestHandler = async (req, res) => {
  const filter = { "reports.user": new Types.ObjectId(req.user!.id) };
  res.json({ issues: await loadList(filter, req.user!.id, false) });
};

export const listAssigned: RequestHandler = async (req, res) => {
  const filter = { assignedTo: new Types.ObjectId(req.user!.id) };
  res.json({ issues: await loadList(filter, req.user!.id) });
};

export const getIssue: RequestHandler = async (req, res) => {
  const record = await loadRecord(String(req.params.id));
  res.json({ issue: toIssueDetailDTO(record, req.user!.id) });
};

export const supportIssue: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (!isValidObjectId(id)) throw new AppError(404, "Issue not found");
  const issue = await Issue.findById(id);
  if (!issue) throw new AppError(404, "Issue not found");
  if (!OPEN_STATUSES.includes(issue.status)) {
    throw new AppError(400, "This issue is closed, so it can no longer be supported");
  }

  const userId = new Types.ObjectId(req.user!.id);
  const index = issue.supporters.findIndex((s) => s.equals(userId));
  if (index >= 0) issue.supporters.splice(index, 1);
  else issue.supporters.push(userId);
  await issue.save();

  const record = await loadRecord(id);
  res.json({ issue: toIssueDetailDTO(record, req.user!.id) });
};

export const assignIssue: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  const { officerId } = req.body as AssignInput;
  if (!isValidObjectId(id)) throw new AppError(404, "Issue not found");

  const issue = await Issue.findById(id);
  if (!issue) throw new AppError(404, "Issue not found");
  if (!OPEN_STATUSES.includes(issue.status)) {
    throw new AppError(400, "Closed issues cannot be reassigned");
  }

  const officer = await User.findOne({ _id: officerId, role: "officer", isActive: true });
  if (!officer) throw new AppError(404, "Officer not found");

  issue.assignedTo = officer._id;
  if (issue.status === "reported") issue.status = "acknowledged";
  issue.timeline.push({
    status: issue.status,
    note: `Assigned to ${officer.name}${officer.department ? ` (${officer.department})` : ""}`,
    by: new Types.ObjectId(req.user!.id),
    byName: req.user!.name,
    at: new Date(),
  });
  await issue.save();

  const record = await loadRecord(id);
  res.json({ issue: toIssueDetailDTO(record, req.user!.id) });
};

export const updateStatus: RequestHandler = async (req, res) => {
  const user = req.user!;
  const id = String(req.params.id);
  const { status, note } = req.body as StatusInput;
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!isValidObjectId(id)) throw new AppError(404, "Issue not found");

  const issue = await Issue.findById(id);
  if (!issue) throw new AppError(404, "Issue not found");

  const isAssignedOfficer = user.role === "officer" && issue.assignedTo?.toString() === user.id;
  if (user.role !== "admin" && !isAssignedOfficer) {
    throw new AppError(403, "Only the assigned officer or an admin can update this issue");
  }

  if (!TRANSITIONS[issue.status].includes(status)) {
    throw new AppError(400, `An issue cannot move from "${issue.status}" to "${status}"`);
  }
  if ((status === "resolved" || status === "rejected") && !note) {
    throw new AppError(400, "Add a short note explaining this decision");
  }
  if (files.length > 0 && !imageStorageEnabled) {
    throw new AppError(503, "Photo upload is not set up on the server yet");
  }
  if (status === "resolved" && imageStorageEnabled && files.length === 0) {
    throw new AppError(400, "Add a photo of the completed work as proof");
  }

  const images = await Promise.all(files.map((f) => uploadImage(f.buffer)));

  issue.status = status;
  issue.resolvedAt = status === "resolved" ? new Date() : undefined;
  if (status === "resolved") issue.verifications.splice(0, issue.verifications.length);
  issue.timeline.push({
    status,
    note,
    images,
    by: new Types.ObjectId(user.id),
    byName: user.name,
    at: new Date(),
  });
  await issue.save();

  const record = await loadRecord(id);
  res.json({ issue: toIssueDetailDTO(record, user.id) });
};

export const verifyIssue: RequestHandler = async (req, res) => {
  const user = req.user!;
  const id = String(req.params.id);
  const { fixed } = req.body as VerifyInput;
  if (!isValidObjectId(id)) throw new AppError(404, "Issue not found");

  const issue = await Issue.findById(id);
  if (!issue) throw new AppError(404, "Issue not found");
  if (issue.status !== "resolved") {
    throw new AppError(400, "Only resolved issues can be verified");
  }

  const userId = new Types.ObjectId(user.id);
  const existing = issue.verifications.find((v) => v.user.equals(userId));
  if (existing) {
    existing.fixed = fixed;
    existing.at = new Date();
  } else {
    issue.verifications.push({ user: userId, fixed, at: new Date() });
  }

  // Reopen when a reporter, or two other citizens, say the problem is still there.
  const reporterIds = new Set(issue.reports.map((r) => r.user.toString()));
  const stillThere = issue.verifications.filter((v) => !v.fixed);
  const reporterVotes = stillThere.filter((v) => reporterIds.has(v.user.toString())).length;
  const otherVotes = stillThere.length - reporterVotes;

  if (reporterVotes >= 1 || otherVotes >= 2) {
    issue.status = "in_progress";
    issue.resolvedAt = undefined;
    issue.timeline.push({
      status: "in_progress",
      note: "Reopened: citizens report the problem is still there",
      images: [],
      byName: "Citizen verification",
      at: new Date(),
    });
  }
  await issue.save();

  const record = await loadRecord(id);
  res.json({ issue: toIssueDetailDTO(record, user.id) });
};
