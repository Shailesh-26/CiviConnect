import type { Category, Status } from "../models/Issue";

const CATEGORY_NAME: Record<Category, string> = {
  pothole: "Pothole",
  garbage: "Garbage",
  drainage: "Drainage",
  streetlight: "Street light",
  fallen_tree: "Fallen tree",
  other: "Other",
};

export const STATUS_NAME: Record<Status, string> = {
  reported: "Reported",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

// "Pothole · CC-D0012" style names for notifications and the audit log.
export const issueName = (issue: { category: Category; customLabel?: string | null; ticket: string }) =>
  `${issue.category === "other" && issue.customLabel ? issue.customLabel : CATEGORY_NAME[issue.category]} · ${issue.ticket}`;

export const categoryName = (c: Category) => CATEGORY_NAME[c];
