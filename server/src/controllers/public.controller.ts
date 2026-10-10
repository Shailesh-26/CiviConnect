import type { RequestHandler } from "express";
import { CATEGORIES, Issue, OPEN_STATUSES } from "../models/Issue";

type PinRecord = {
  _id: { toString(): string };
  ticket: string;
  category: string;
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
    Issue.find({}, "ticket category status location reports createdAt")
      .sort({ createdAt: -1 })
      .limit(250)
      .lean() as unknown as Promise<PinRecord[]>,
    Issue.aggregate([
      { $unwind: "$timeline" },
      { $sort: { "timeline.at": -1 } },
      { $limit: 8 },
      { $project: { _id: 0, ticket: 1, category: 1, address: 1, status: "$timeline.status", at: "$timeline.at" } },
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
      status: p.status,
      reportCount: p.reports.length,
      location: { lat: p.location.coordinates[1], lng: p.location.coordinates[0] },
    })),
    activity,
  });
};
