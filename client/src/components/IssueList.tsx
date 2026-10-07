import { Link } from "react-router-dom";
import { categoryMeta } from "../lib/constants";
import type { Issue } from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { PriorityMeter } from "./PriorityMeter";
import { StatusBadge } from "./StatusBadge";

export function IssueList({ issues, empty }: { issues: Issue[]; empty: string }) {
  if (issues.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-ink/20 px-4 py-10 text-center text-sm text-ink/60">
        {empty}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-ink/10 overflow-hidden rounded-lg border border-ink/15 bg-white">
      {issues.map((issue) => (
        <li key={issue.id}>
          <Link to={`/issues/${issue.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-paper">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-signboard/10 text-signboard">
              <CategoryIcon category={issue.category} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="font-medium">{categoryMeta(issue.category).label}</span>
                <span className="text-xs tabular-nums text-ink/50">{issue.ticket}</span>
              </span>
              <span className="block truncate text-sm text-ink/70">{issue.address || issue.description}</span>
            </span>
            <span className="hidden w-28 shrink-0 sm:block">
              <PriorityMeter score={issue.priority} label={issue.priorityLabel} />
            </span>
            <span className="hidden w-20 shrink-0 text-xs text-ink/60 md:block">
              {issue.reportCount} {issue.reportCount === 1 ? "report" : "reports"}
            </span>
            <StatusBadge status={issue.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
