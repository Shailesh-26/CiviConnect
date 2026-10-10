import type { RequestHandler } from "express";
import { isValidObjectId, Types } from "mongoose";
import { Comment } from "../models/Comment";
import { Flag } from "../models/Flag";
import { CATEGORIES, Issue, OPEN_STATUSES, type Category } from "../models/Issue";
import { RADIUS_CHOICES, User } from "../models/User";
import { AppError } from "../utils/AppError";
import { deleteImage, imageStorageEnabled, uploadImage } from "../utils/cloudinary";
import { normaliseLabel } from "../utils/customIcons";
import { toIssueDTO, type IssueRecord } from "../utils/issueDto";
import { similarity } from "../utils/textMatch";
import type { CommentInput, FlagInput } from "../validators/community.schemas";

const assigneeFields = { path: "assignedTo", select: "name department" };
const authorFields = "name avatar role department";
const HIDE_AFTER_FLAGS = 3;
const PAGE_SIZE = 15;

type GeoRecord = IssueRecord & { distance: number };

async function findIssue(id: string) {
  if (!isValidObjectId(id)) throw new AppError(404, "Issue not found");
  const issue = await Issue.findById(id);
  if (!issue) throw new AppError(404, "Issue not found");
  return issue;
}

function point(lat: number, lng: number) {
  return { type: "Point" as const, coordinates: [lng, lat] as [number, number] };
}

function readLatLng(query: Record<string, unknown>) {
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

// ---------------------------------------------------------------- Neighbourhood feed

const SORTS = ["hot", "new", "top", "unresolved", "resolved"] as const;
type Sort = (typeof SORTS)[number];

/**
 * Issues within a radius of the viewer's home (or a given point), sorted like a community board.
 * "Hot" rewards recent activity: (support + extra reports + comments + 1) / (age in days + 2)^1.3,
 * with open issues boosted so fixed ones sink.
 */
export const getFeed: RequestHandler = async (req, res) => {
  const viewer = req.user!;
  const me = await User.findById(viewer.id).select("+hiddenIssues homeLocation radiusKm");
  const center = readLatLng(req.query) ?? (me?.homeLocation?.lat != null ? { lat: me.homeLocation.lat, lng: me.homeLocation.lng! } : null);
  if (!center) {
    throw new AppError(400, "Set your home spot or share your location to see your neighbourhood", { code: "NO_LOCATION" });
  }

  const askedRadius = Number(req.query.radiusKm);
  const radiusKm = (RADIUS_CHOICES as readonly number[]).includes(askedRadius) ? askedRadius : (me?.radiusKm ?? 2);
  const sort: Sort = (SORTS as readonly string[]).includes(String(req.query.sort)) ? (req.query.sort as Sort) : "hot";
  const category = (CATEGORIES as readonly string[]).includes(String(req.query.category)) ? (req.query.category as Category) : undefined;
  const page = Math.max(1, Math.min(50, Number(req.query.page) || 1));

  const match: Record<string, unknown> = { _id: { $nin: me?.hiddenIssues ?? [] } };
  if (category) match.category = category;
  if (sort === "unresolved") match.status = { $in: OPEN_STATUSES };
  if (sort === "resolved") match.status = "resolved";

  const records = (await Issue.aggregate([
    {
      $geoNear: {
        near: point(center.lat, center.lng),
        distanceField: "distance",
        maxDistance: radiusKm * 1000,
        spherical: true,
        query: match,
      },
    },
    { $limit: 400 },
  ])) as GeoRecord[];
  await Issue.populate(records, assigneeFields);

  const now = Date.now();
  const hot = (r: GeoRecord) => {
    const ageDays = (now - new Date(r.lastActivityAt ?? r.updatedAt).getTime()) / 86_400_000;
    const weight = r.supporters.length + 2 * Math.max(0, r.reports.length - 1) + (r.commentCount ?? 0) + 1;
    const open = OPEN_STATUSES.includes(r.status) ? 1.5 : 1;
    return (weight * open) / Math.pow(Math.max(ageDays, 0) + 2, 1.3);
  };
  const time = (d?: Date | null) => (d ? new Date(d).getTime() : 0);
  const sorters: Record<Sort, (a: GeoRecord, b: GeoRecord) => number> = {
    hot: (a, b) => hot(b) - hot(a),
    new: (a, b) => time(b.createdAt) - time(a.createdAt),
    top: (a, b) => b.supporters.length + b.reports.length - (a.supporters.length + a.reports.length),
    unresolved: (a, b) => toIssueDTO(b).priority - toIssueDTO(a).priority,
    resolved: (a, b) => time(b.resolvedAt) - time(a.resolvedAt),
  };
  records.sort(sorters[sort]);

  const slice = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const flagged = (await Flag.find({
    user: new Types.ObjectId(viewer.id),
    targetType: "issue",
    target: { $in: slice.map((r) => new Types.ObjectId(r._id.toString())) },
  })
    .select("target")
    .lean()) as unknown as { target: Types.ObjectId }[];
  const flaggedIds = new Set(flagged.map((f) => f.target.toString()));

  res.json({
    center,
    radiusKm,
    sort,
    total: records.length,
    page,
    hasMore: page * PAGE_SIZE < records.length,
    items: slice.map((r) => {
      const last = r.timeline[r.timeline.length - 1];
      return {
        ...toIssueDTO(r, viewer.id),
        distanceM: Math.round(r.distance),
        flaggedByMe: flaggedIds.has(r._id.toString()),
        latestUpdate: last ? { status: last.status, note: last.note ?? null, at: last.at } : null,
      };
    }),
  });
};

// ---------------------------------------------------------------- Similar issues (report wizard)

/**
 * Open issues within 200 m of a spot, each with a match score from 0 to 100:
 *   50% distance (closer is higher), 35% same category (or same "Other" name), 15% shared words.
 * The weights are hand-chosen for now and are shown to the user only as a hint.
 */
export const getNearby: RequestHandler = async (req, res) => {
  const at = readLatLng(req.query);
  if (!at) throw new AppError(400, "Pick a spot on the map first");
  const category = (CATEGORIES as readonly string[]).includes(String(req.query.category)) ? String(req.query.category) : null;
  const labelKey = typeof req.query.label === "string" ? normaliseLabel(req.query.label) : "";
  const text = typeof req.query.text === "string" ? req.query.text.slice(0, 1000) : "";

  const records = (await Issue.aggregate([
    {
      $geoNear: {
        near: point(at.lat, at.lng),
        distanceField: "distance",
        maxDistance: 200,
        spherical: true,
        query: { status: { $in: OPEN_STATUSES } },
      },
    },
    { $limit: 20 },
  ])) as (GeoRecord & { customLabelKey?: string })[];
  await Issue.populate(records, assigneeFields);

  const items = records
    .map((r) => {
      const sameKind = category === null ? 0.5 : r.category === category ? (category === "other" ? (labelKey && r.customLabelKey === labelKey ? 1 : 0.3) : 1) : 0;
      const words = text ? similarity(text, r.reports.map((rep) => rep.description).join(" ")) : 0;
      const near = Math.max(0, 1 - r.distance / 200);
      const confidence = Math.round(100 * (0.5 * near + 0.35 * sameKind + 0.15 * Math.min(1, words * 2)));
      const willMerge = r.distance <= 50 && r.category === category && (category !== "other" || r.customLabelKey === labelKey);
      return { ...toIssueDTO(r, req.user!.id), distanceM: Math.round(r.distance), confidence, willMerge };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6);

  res.json({ items });
};

// ---------------------------------------------------------------- Follow / hide

export const toggleFollow: RequestHandler = async (req, res) => {
  const issue = await findIssue(String(req.params.id));
  const userId = new Types.ObjectId(req.user!.id);
  const index = issue.followers.findIndex((f) => f.equals(userId));
  if (index >= 0) issue.followers.splice(index, 1);
  else issue.followers.push(userId);
  await issue.save();
  res.json({ following: index < 0 });
};

export const toggleHide: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  await findIssue(id);
  const user = await User.findById(req.user!.id).select("+hiddenIssues");
  if (!user) throw new AppError(401, "Account not found or disabled");
  const issueId = new Types.ObjectId(id);
  const index = user.hiddenIssues.findIndex((h) => h.equals(issueId));
  if (index >= 0) user.hiddenIssues.splice(index, 1);
  else user.hiddenIssues.push(issueId);
  await user.save();
  res.json({ hidden: index < 0 });
};

// ---------------------------------------------------------------- Flags

export const flagIssue: RequestHandler = async (req, res) => {
  const { reason, note } = req.body as FlagInput;
  const issue = await findIssue(String(req.params.id));
  try {
    await Flag.create({ targetType: "issue", target: issue._id, issue: issue._id, user: req.user!.id, reason, note });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new AppError(409, "You already reported this issue to the admins");
    throw err;
  }
  await Issue.updateOne({ _id: issue._id }, { $inc: { flagCount: 1 } });
  res.status(201).json({ message: "Thanks. An admin will review it." });
};

export const flagComment: RequestHandler = async (req, res) => {
  const { reason, note } = req.body as FlagInput;
  const id = String(req.params.id);
  if (!isValidObjectId(id)) throw new AppError(404, "Comment not found");
  const comment = await Comment.findById(id);
  if (!comment || comment.deleted) throw new AppError(404, "Comment not found");
  if (comment.user.toString() === req.user!.id) throw new AppError(400, "You cannot report your own comment");

  try {
    await Flag.create({ targetType: "comment", target: comment._id, issue: comment.issue, user: req.user!.id, reason, note });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new AppError(409, "You already reported this comment");
    throw err;
  }
  comment.flaggedBy.push(new Types.ObjectId(req.user!.id));
  if (comment.flaggedBy.length >= HIDE_AFTER_FLAGS) comment.hidden = true;
  await comment.save();
  res.status(201).json({ message: "Thanks. An admin will review it.", hidden: comment.hidden });
};

// ---------------------------------------------------------------- Comments

type Author = { _id: Types.ObjectId; name: string; role: string; department?: string; avatar?: { emoji?: string; color?: string; url?: string } };
type CommentRecord = {
  _id: Types.ObjectId;
  user: Author | null;
  parent: Types.ObjectId | null;
  body?: string;
  images: { url: string }[];
  official: boolean;
  flaggedBy: Types.ObjectId[];
  hidden: boolean;
  deleted: boolean;
  createdAt: Date;
};

function toCommentDTO(c: CommentRecord, viewer: { id: string; role: string }) {
  const mine = c.user?._id.toString() === viewer.id;
  const isAdmin = viewer.role === "admin";
  const concealed = c.deleted || (c.hidden && !mine && !isAdmin);
  return {
    id: c._id.toString(),
    parentId: c.parent ? c.parent.toString() : null,
    body: concealed ? null : (c.body ?? ""),
    images: concealed ? [] : c.images.map((i) => ({ url: i.url })),
    official: c.official,
    deleted: c.deleted,
    hidden: c.hidden,
    author: c.deleted || !c.user
      ? null
      : {
          name: c.user.name,
          role: c.user.role,
          department: c.user.department ?? null,
          avatar: c.user.avatar && (c.user.avatar.url || c.user.avatar.emoji)
            ? { emoji: c.user.avatar.emoji ?? null, color: c.user.avatar.color ?? null, url: c.user.avatar.url ?? null }
            : null,
        },
    isMine: mine,
    canDelete: !c.deleted && (mine || isAdmin),
    flaggedByMe: c.flaggedBy.some((f) => f.toString() === viewer.id),
    createdAt: c.createdAt,
  };
}

export const listComments: RequestHandler = async (req, res) => {
  const issue = await findIssue(String(req.params.id));
  const comments = (await Comment.find({ issue: issue._id })
    .sort({ createdAt: 1 })
    .limit(500)
    .populate("user", authorFields)
    .lean()) as unknown as CommentRecord[];
  res.json({ comments: comments.map((c) => toCommentDTO(c, req.user!)) });
};

export const addComment: RequestHandler = async (req, res) => {
  const viewer = req.user!;
  const { body, parentId } = req.body as CommentInput;
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const issue = await findIssue(String(req.params.id));

  let parent: Types.ObjectId | null = null;
  if (parentId) {
    const target = await Comment.findOne({ _id: parentId, issue: issue._id });
    if (!target) throw new AppError(404, "The comment you are replying to was removed");
    // Only one level of replies: a reply to a reply joins the same top-level thread.
    parent = target.parent ?? target._id;
  }
  if (files.length > 0 && !imageStorageEnabled) {
    throw new AppError(503, "Photo upload is not set up on the server yet");
  }

  const images = await Promise.all(files.map((f) => uploadImage(f.buffer)));
  const created = await Comment.create({
    issue: issue._id,
    user: viewer.id,
    parent,
    body,
    images,
    official: viewer.role !== "citizen",
  });

  const userId = new Types.ObjectId(viewer.id);
  await Issue.updateOne(
    { _id: issue._id },
    { $inc: { commentCount: 1 }, $set: { lastActivityAt: new Date() }, $addToSet: { followers: userId } },
  );

  const record = (await Comment.findById(created._id).populate("user", authorFields).lean()) as unknown as CommentRecord;
  res.status(201).json({ comment: toCommentDTO(record, viewer) });
};

export const deleteComment: RequestHandler = async (req, res) => {
  const viewer = req.user!;
  const id = String(req.params.id);
  if (!isValidObjectId(id)) throw new AppError(404, "Comment not found");
  const comment = await Comment.findById(id);
  if (!comment || comment.deleted) throw new AppError(404, "Comment not found");
  if (comment.user.toString() !== viewer.id && viewer.role !== "admin") {
    throw new AppError(403, "You can only delete your own comments");
  }

  const photos = comment.images.map((i) => i.publicId);
  comment.deleted = true;
  comment.body = undefined;
  comment.images.splice(0, comment.images.length);
  await comment.save();
  await Promise.all(photos.map((p) => deleteImage(p)));
  await Issue.updateOne({ _id: comment.issue, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } });

  res.json({ message: "Comment deleted" });
};
