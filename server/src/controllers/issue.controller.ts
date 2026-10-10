import type { RequestHandler } from "express";
import { isValidObjectId, Types } from "mongoose";
import { CATEGORIES, Issue, OPEN_STATUSES, STATUSES, type Channel, type Source, type Status } from "../models/Issue";
import { User } from "../models/User";
import { AppError } from "../utils/AppError";
import { imageStorageEnabled, uploadImage } from "../utils/cloudinary";
import { normaliseLabel } from "../utils/customIcons";
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

const CHANNEL_LABEL: Record<Channel, string> = { phone: "phone call", walk_in: "walk-in visit", email: "email", letter: "letter" };

/**
 * Who may open an issue, and how:
 *  - citizen: an ordinary report. Merges into an open issue of the same kind within 50 m.
 *  - officer: a field inspection. Assigned to the officer straight away. If the problem is
 *    already logged nearby, the officer is pointed to that issue instead of adding a report.
 *  - admin:   a complaint registered for a citizen who phoned, walked in or wrote. Needs the
 *    citizen's name and the channel. Merges like a citizen report.
 */
export const createIssue: RequestHandler = async (req, res) => {
  const user = req.user!;
  const input = req.body as CreateIssueInput;
  const { category, description, lat, lng, address } = input;
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];

  const source: Source = user.role === "officer" ? "field_inspection" : user.role === "admin" ? "on_behalf" : "citizen";

  let customLabel: string | undefined;
  let customLabelKey: string | undefined;
  let customIcon: string | undefined;
  if (category === "other") {
    customLabel = input.customLabel?.replace(/\s+/g, " ");
    customLabelKey = customLabel ? normaliseLabel(customLabel) : "";
    if (!customLabel || customLabelKey.length < 3) {
      throw new AppError(400, "Please fix the highlighted fields", {
        errors: [{ field: "customLabel", message: "Give the problem a short name (at least 3 letters)" }],
      });
    }
    customIcon = input.customIcon ?? "circle-help";
  }

  let onBehalf: { name: string; channel: Channel } | undefined;
  if (source === "on_behalf") {
    const errors = [];
    if (!input.onBehalfName || input.onBehalfName.length < 2) {
      errors.push({ field: "onBehalfName", message: "Enter the citizen's name" });
    }
    if (!input.channel) errors.push({ field: "channel", message: "Choose how they contacted you" });
    if (errors.length) throw new AppError(400, "Please fix the highlighted fields", { errors });
    onBehalf = { name: input.onBehalfName!, channel: input.channel! };
  }

  if (files.length > 0 && !imageStorageEnabled) {
    throw new AppError(503, "Photo upload is not set up on the server yet");
  }

  const point = { type: "Point" as const, coordinates: [lng, lat] };
  const userId = new Types.ObjectId(user.id);

  // "Other" problems only merge when their names match, e.g. two "open manhole" reports.
  const nearby = await Issue.findOne({
    category,
    ...(category === "other" ? { customLabelKey } : {}),
    status: { $in: OPEN_STATUSES },
    location: { $near: { $geometry: point, $maxDistance: MERGE_RADIUS_METERS } },
  });

  if (nearby && source === "field_inspection") {
    throw new AppError(409, `This problem is already logged as ${nearby.ticket}. Open it to update it instead.`, {
      issueId: nearby.id,
      ticket: nearby.ticket,
    });
  }
  if (nearby && source === "citizen" && nearby.reports.some((r) => r.user.equals(userId))) {
    throw new AppError(409, `You already reported this problem (${nearby.ticket})`, {
      issueId: nearby.id,
      ticket: nearby.ticket,
    });
  }

  const images = await Promise.all(files.map((f) => uploadImage(f.buffer)));
  const report = { user: userId, description, images, source, onBehalf };

  let issueId: string;
  let merged = false;

  if (nearby) {
    nearby.reports.push(report);
    await nearby.save();
    issueId = nearby.id;
    merged = true;
  } else {
    const now = new Date();
    const firstNote =
      source === "field_inspection"
        ? `Logged during a field inspection by ${user.name}`
        : source === "on_behalf"
          ? `Complaint registered by ${user.name} for a citizen (${CHANNEL_LABEL[onBehalf!.channel]})`
          : "Issue reported";
    const timeline: { status: Status; note: string; by: Types.ObjectId; byName: string; at: Date }[] = [
      { status: "reported", note: firstNote, by: userId, byName: user.name, at: now },
    ];
    if (source === "field_inspection") {
      timeline.push({
        status: "acknowledged",
        note: `Assigned to ${user.name}${user.department ? ` (${user.department})` : ""}`,
        by: userId,
        byName: user.name,
        at: now,
      });
    }

    const created = await Issue.create({
      ticket: newTicket(),
      category,
      customLabel,
      customLabelKey,
      customIcon,
      source,
      address: address || undefined,
      location: point,
      status: source === "field_inspection" ? "acknowledged" : "reported",
      assignedTo: source === "field_inspection" ? userId : undefined,
      reports: [report],
      timeline,
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
