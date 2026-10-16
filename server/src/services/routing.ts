import type { Types } from "mongoose";
import { Issue, OPEN_STATUSES, type Category } from "../models/Issue";
import { User } from "../models/User";

// Words that link an officer's department to a category, used for smart routing.
const DEPT_HINTS: Record<Category, string[]> = {
  pothole: ["road", "pave", "engineer"],
  garbage: ["sanit", "waste", "garbage", "clean"],
  drainage: ["drain", "sewer", "water"],
  streetlight: ["light", "electric"],
  fallen_tree: ["tree", "park", "horti", "green"],
  other: ["road", "general", "ward"],
};

export type OfficerLite = { _id: Types.ObjectId; name: string; department?: string | null; onLeaveSince?: Date | null };

export const isAvailable = (o: { onLeaveSince?: Date | null }) => !o.onLeaveSince;

/**
 * Suggest who should take an issue: experience with the category (past assignments),
 * a department that matches, and spare capacity (fewer open issues). Weights are simple and visible.
 * Officers on leave are never suggested.
 */
export function suggest(category: Category, officers: OfficerLite[], history: Map<string, number>, load: Map<string, number>) {
  let best: { officer: OfficerLite; score: number } | null = null;
  for (const o of officers) {
    if (!isAvailable(o)) continue;
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

// Everything `suggest` needs, loaded fresh from the database (used outside the Command Center).
export async function routingContext() {
  const [officers, history, open] = await Promise.all([
    User.find({ role: "officer", isActive: true }).select("name department onLeaveSince").lean() as unknown as Promise<OfficerLite[]>,
    Issue.aggregate([{ $match: { assignedTo: { $ne: null } } }, { $group: { _id: { o: "$assignedTo", c: "$category" }, n: { $sum: 1 } } }]),
    Issue.aggregate([{ $match: { status: { $in: OPEN_STATUSES }, assignedTo: { $ne: null } } }, { $group: { _id: "$assignedTo", n: { $sum: 1 } } }]),
  ]);
  return {
    officers,
    history: new Map(history.map((h) => [`${h._id.o}:${h._id.c}`, h.n as number])),
    load: new Map(open.map((o) => [String(o._id), o.n as number])),
  };
}
