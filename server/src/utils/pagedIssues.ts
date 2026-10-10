import type { PipelineStage } from "mongoose";
import { CATEGORIES, Issue, OPEN_STATUSES } from "../models/Issue";
import { toIssueDTO, type IssueRecord } from "./issueDto";

const GROUPS = ["all", "open", "in_progress", "resolved", "rejected"] as const;
type Group = (typeof GROUPS)[number];
const SORTS = ["priority", "newest", "oldest", "support", "reports"] as const;
type Sort = (typeof SORTS)[number];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The same priority formula as utils/priority.ts, written as a MongoDB expression so the
// database can sort and page by priority without loading every issue into memory.
const PRIORITY_EXPR = {
  $round: [
    {
      $min: [
        100,
        {
          $add: [
            {
              $multiply: [
                5,
                {
                  $switch: {
                    branches: [
                      { case: { $eq: ["$category", "fallen_tree"] }, then: 9 },
                      { case: { $eq: ["$category", "drainage"] }, then: 8 },
                      { case: { $eq: ["$category", "pothole"] }, then: 7 },
                      { case: { $eq: ["$category", "streetlight"] }, then: 6 },
                      { case: { $eq: ["$category", "garbage"] }, then: 5 },
                    ],
                    default: 4,
                  },
                },
              ],
            },
            { $multiply: [3, { $min: [10, { $max: [0, { $subtract: [{ $size: "$reports" }, 1] }] }] }] },
            { $multiply: [1.5, { $min: [10, { $size: "$supporters" }] }] },
            { $min: [10, { $max: [0, { $divide: [{ $subtract: ["$$NOW", "$createdAt"] }, 86_400_000] }] }] },
            { $cond: [{ $ifNull: ["$escalatedAt", false] }, 15, 0] },
          ],
        },
      ],
    },
    0,
  ],
};

const groupMatch = (g: Group) =>
  g === "all" ? {} : g === "open" ? { status: { $in: OPEN_STATUSES } } : { status: g };

/**
 * One page of issues with server-side search, filters, sorting and status counts.
 * Query: page, limit (max 50), q, group, category, sort.
 */
export async function pagedIssues(base: Record<string, unknown>, query: Record<string, unknown>, viewerId: string, defaultSort: Sort = "priority") {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const limit = Math.min(50, Math.max(5, Math.floor(Number(query.limit) || 20)));
  const group: Group = (GROUPS as readonly string[]).includes(String(query.group)) ? (query.group as Group) : "all";
  const sort: Sort = (SORTS as readonly string[]).includes(String(query.sort)) ? (query.sort as Sort) : defaultSort;

  const match: Record<string, unknown> = { ...base };
  if ((CATEGORIES as readonly string[]).includes(String(query.category))) match.category = query.category;
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 80) : "";
  if (q) {
    // Every word must appear somewhere: ticket, name, landmark or what was reported.
    match.$and = q.split(/\s+/).map((word) => {
      const rx = { $regex: escapeRegex(word), $options: "i" };
      return { $or: [{ ticket: rx }, { customLabel: rx }, { address: rx }, { category: rx }, { "reports.description": rx }] };
    });
  }

  const sortStage: Record<string, 1 | -1> =
    sort === "priority" ? { priority: -1, createdAt: -1 }
    : sort === "newest" ? { createdAt: -1 }
    : sort === "oldest" ? { createdAt: 1 }
    : sort === "support" ? { supportCount: -1, createdAt: -1 }
    : { reportCount: -1, createdAt: -1 };

  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $facet: {
        counts: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
        total: [{ $match: groupMatch(group) }, { $count: "n" }],
        rows: [
          { $match: groupMatch(group) },
          { $addFields: { priority: PRIORITY_EXPR, supportCount: { $size: "$supporters" }, reportCount: { $size: "$reports" } } },
          { $sort: sortStage },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ],
      },
    },
  ];

  const [result] = (await Issue.aggregate(pipeline)) as { counts: { _id: string; n: number }[]; total: { n: number }[]; rows: IssueRecord[] }[];
  await Issue.populate(result.rows, { path: "assignedTo", select: "name department" });

  const by = new Map(result.counts.map((c) => [c._id, c.n]));
  const all = result.counts.reduce((a, c) => a + c.n, 0);
  const total = result.total[0]?.n ?? 0;
  return {
    issues: result.rows.map((r) => toIssueDTO(r, viewerId)),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    counts: {
      all,
      open: OPEN_STATUSES.reduce((a, s) => a + (by.get(s) ?? 0), 0),
      in_progress: by.get("in_progress") ?? 0,
      resolved: by.get("resolved") ?? 0,
      rejected: by.get("rejected") ?? 0,
    },
  };
}
