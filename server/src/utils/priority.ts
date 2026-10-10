import type { Category } from "../models/Issue";

// How dangerous or disruptive each kind of problem is, out of 10.
const HAZARD: Record<Category, number> = {
  fallen_tree: 9,
  drainage: 8,
  pothole: 7,
  streetlight: 6,
  garbage: 5,
  other: 4,
};

type PriorityInput = {
  category: Category;
  reportCount: number;
  supporterCount: number;
  createdAt: Date;
  // Overdue issues that were escalated by the SLA sweep get a boost.
  escalated?: boolean;
};

/**
 * Priority score from 0 to 100:
 *   hazard of the category   up to 45
 *   extra reports (merged)   up to 30
 *   citizen support          up to 15
 *   days open                up to 10
 *   escalated (overdue)      +15
 */
export function computePriority({ category, reportCount, supporterCount, createdAt, escalated = false }: PriorityInput) {
  const hazard = HAZARD[category] * 5;
  const reports = Math.min(Math.max(reportCount - 1, 0), 10) * 3;
  const support = Math.min(supporterCount, 10) * 1.5;
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  const age = Math.min(Math.max(ageDays, 0), 10);
  return Math.round(Math.min(100, hazard + reports + support + age + (escalated ? 15 : 0)));
}

export const priorityLabel = (score: number) => (score >= 70 ? "high" : score >= 40 ? "medium" : "low");
