import { issueLabel, OPEN } from "./constants";
import type { Category, Issue } from "../types";

export type StatusGroup = "all" | "open" | "in_progress" | "resolved" | "rejected";
export type SortKey = "priority" | "newest" | "oldest" | "support" | "reports";

export type IssueFilters = { q: string; group: StatusGroup; category: Category | ""; sort: SortKey };

export const STATUS_GROUPS: { value: StatusGroup; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
];

export const SORTS: { value: SortKey; label: string }[] = [
  { value: "priority", label: "Highest priority" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "support", label: "Most supported" },
  { value: "reports", label: "Most reports" },
];

const inGroup = (issue: Issue, group: StatusGroup) =>
  group === "all" ? true : group === "open" ? OPEN.includes(issue.status) : issue.status === group;

export function groupCounts(issues: Issue[]): Record<StatusGroup, number> {
  const counts = { all: 0, open: 0, in_progress: 0, resolved: 0, rejected: 0 };
  for (const g of STATUS_GROUPS) counts[g.value] = issues.filter((i) => inGroup(i, g.value)).length;
  return counts;
}

export function applyFilters(issues: Issue[], f: IssueFilters): Issue[] {
  const words = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = issues.filter((issue) => {
    if (!inGroup(issue, f.group)) return false;
    if (f.category && issue.category !== f.category) return false;
    if (words.length === 0) return true;
    const haystack = [issue.ticket, issueLabel(issue), issue.address ?? "", issue.description, issue.assignedTo?.name ?? ""]
      .join(" ")
      .toLowerCase();
    return words.every((w) => haystack.includes(w));
  });

  const time = (iso: string) => new Date(iso).getTime();
  const by: Record<SortKey, (a: Issue, b: Issue) => number> = {
    priority: (a, b) => b.priority - a.priority,
    newest: (a, b) => time(b.createdAt) - time(a.createdAt),
    oldest: (a, b) => time(a.createdAt) - time(b.createdAt),
    support: (a, b) => b.supporterCount - a.supporterCount,
    reports: (a, b) => b.reportCount - a.reportCount,
  };
  return [...matches].sort(by[f.sort]);
}
