import type { RequestHandler } from "express";
import { CATEGORIES, Issue, OPEN_STATUSES } from "../models/Issue";

type PinRecord = {
  _id: { toString(): string };
  ticket: string;
  category: string;
  customLabel?: string | null;
  customIcon?: string | null;
  status: string;
  location: { coordinates: number[] };
  reports: unknown[];
};

// Everything here is public and anonymous: no reporter identities, no descriptions, no photos.
export const getOverview: RequestHandler = async (_req, res) => {
  const [counts, reportTotals, resolution, byCategory, pins, activity] = await Promise.all([
    Issue.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Issue.aggregate([{ $group: { _id: null, reports: { $sum: { $size: "$reports" } } } }]),
    Issue.aggregate([
      { $match: { status: "resolved", resolvedAt: { $ne: null } } },
      { $group: { _id: null, avgMs: { $avg: { $subtract: ["$resolvedAt", "$createdAt"] } } } },
    ]),
    Issue.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]),
    Issue.find({}, "ticket category customLabel customIcon status location reports createdAt")
      .sort({ createdAt: -1 })
      .limit(250)
      .lean() as unknown as Promise<PinRecord[]>,
    Issue.aggregate([
      { $unwind: "$timeline" },
      { $sort: { "timeline.at": -1 } },
      { $limit: 8 },
      { $project: { _id: 0, ticket: 1, category: 1, customLabel: 1, customIcon: 1, address: 1, status: "$timeline.status", at: "$timeline.at" } },
    ]),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of counts) byStatus[row._id] = row.count;
  const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
  const open = OPEN_STATUSES.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0);

  res.json({
    stats: {
      total,
      open,
      resolved: byStatus.resolved ?? 0,
      reports: reportTotals[0]?.reports ?? 0,
      avgResolutionHours: resolution[0] ? resolution[0].avgMs / 3_600_000 : null,
      byCategory: CATEGORIES.map((c) => ({
        category: c,
        count: byCategory.find((row) => row._id === c)?.count ?? 0,
      })),
    },
    pins: pins.map((p) => ({
      id: p._id.toString(),
      ticket: p.ticket,
      category: p.category,
      customLabel: p.customLabel ?? null,
      customIcon: p.customIcon ?? null,
      status: p.status,
      reportCount: p.reports.length,
      location: { lat: p.location.coordinates[1], lng: p.location.coordinates[0] },
    })),
    activity,
  });
};

type PublicIssueRecord = {
  ticket: string;
  category: string;
  customLabel?: string | null;
  customIcon?: string | null;
  status: string;
  address?: string | null;
  location: { coordinates: number[] };
  reports: { images: { url: string }[] }[];
  supporters: unknown[];
  commentCount?: number;
  timeline: { status: string; note?: string | null; images?: { url: string }[]; at: Date }[];
  resolvedAt?: Date | null;
  createdAt: Date;
};

// A shareable, read-only view of one issue for people without an account. No names at all.
export const getPublicIssue: RequestHandler = async (req, res) => {
  const ticket = String(req.params.ticket).toUpperCase();
  if (!/^CC-[A-Z0-9]{4,12}$/.test(ticket)) {
    res.status(404).json({ message: "Issue not found" });
    return;
  }
  const issue = (await Issue.findOne({ ticket }).lean()) as unknown as PublicIssueRecord | null;
  if (!issue) {
    res.status(404).json({ message: "Issue not found" });
    return;
  }
  const before = issue.reports.flatMap((r) => r.images)[0] ?? null;
  const fix = [...issue.timeline].reverse().find((t) => t.status === "resolved" && (t.images?.length ?? 0) > 0);
  res.json({
    issue: {
      ticket: issue.ticket,
      category: issue.category,
      customLabel: issue.category === "other" ? (issue.customLabel ?? null) : null,
      customIcon: issue.category === "other" ? (issue.customIcon ?? null) : null,
      status: issue.status,
      address: issue.address ?? null,
      location: { lat: issue.location.coordinates[1], lng: issue.location.coordinates[0] },
      reportCount: issue.reports.length,
      supporterCount: issue.supporters.length,
      commentCount: issue.commentCount ?? 0,
      before: before ? { url: before.url } : null,
      after: issue.status === "resolved" && fix?.images?.[0] ? { url: fix.images[0].url } : null,
      timeline: issue.timeline.map((t) => ({ status: t.status, note: t.note ?? null, at: t.at })),
      resolvedAt: issue.resolvedAt ?? null,
      createdAt: issue.createdAt,
    },
  });
};
