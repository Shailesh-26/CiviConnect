import { CATEGORIES, type Category, type Status } from "../models/Issue";
import { CategoryConfig } from "../models/CategoryConfig";

// Default fix-by times in hours. Admins can change them on the Admin page.
export const DEFAULT_SLA_HOURS: Record<Category, number> = {
  fallen_tree: 24,
  drainage: 48,
  garbage: 48,
  pothole: 72,
  streetlight: 72,
  other: 120,
};

// Kept in memory so every response can show SLA without an extra query.
const hours: Record<Category, number> = { ...DEFAULT_SLA_HOURS };

export async function loadSlaConfig() {
  const rows = await CategoryConfig.find().lean();
  for (const c of CATEGORIES) hours[c] = DEFAULT_SLA_HOURS[c];
  for (const row of rows) hours[row.category as Category] = row.slaHours;
}

export const slaHoursFor = (category: Category) => hours[category];
export const slaTable = () => CATEGORIES.map((c) => ({ category: c, slaHours: hours[c], defaultHours: DEFAULT_SLA_HOURS[c] }));

export function setSlaHours(category: Category, value: number) {
  hours[category] = value;
}

export const dueFrom = (category: Category, from: Date) => new Date(from.getTime() + slaHoursFor(category) * 3_600_000);

export type SlaState = "ok" | "warning" | "breached" | "met" | "missed" | "none";

// Warning when less than a quarter of the allowed time is left.
export function slaInfo(issue: { category: Category; status: Status; createdAt: Date; slaDueAt?: Date | null; resolvedAt?: Date | null; escalatedAt?: Date | null }) {
  const due = issue.slaDueAt ? new Date(issue.slaDueAt) : dueFrom(issue.category, new Date(issue.createdAt));
  const totalMs = slaHoursFor(issue.category) * 3_600_000;
  let state: SlaState;
  if (issue.status === "rejected") state = "none";
  else if (issue.status === "resolved") state = issue.resolvedAt && new Date(issue.resolvedAt) <= due ? "met" : "missed";
  else {
    const left = due.getTime() - Date.now();
    state = left < 0 ? "breached" : left < totalMs * 0.25 ? "warning" : "ok";
  }
  return {
    dueAt: due,
    hours: slaHoursFor(issue.category),
    hoursLeft: Math.round(((due.getTime() - Date.now()) / 3_600_000) * 10) / 10,
    state,
    escalated: Boolean(issue.escalatedAt),
  };
}
