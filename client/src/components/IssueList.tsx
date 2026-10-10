import { Link } from "react-router-dom";
import { ClipboardPen, Clock, Headset, Layers, ThumbsUp } from "lucide-react";
import { issueLabel, SOURCE_META } from "../lib/constants";
import { daysOpen } from "../lib/format";
import type { Issue } from "../types";
import { CategoryChip } from "./CategoryChip";
import { PriorityMeter } from "./PriorityMeter";
import { StatusBadge } from "./StatusBadge";

export function IssueList({ issues, empty }: { issues: Issue[]; empty: string }) {
  if (issues.length === 0) {
    return <p className="card border-dashed px-4 py-12 text-center text-sm text-ink/60 shadow-none">{empty}</p>;
  }

  return (
    <ul className="space-y-3">
      {issues.map((issue, index) => {
        const open = issue.status !== "resolved" && issue.status !== "rejected";
        return (
          <li key={issue.id} className="animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
            <Link to={`/issues/${issue.id}`} className="card card-hover flex items-center gap-4 p-4">
              <CategoryChip category={issue.category} icon={issue.customIcon} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-display text-base font-semibold">{issueLabel(issue)}</span>
                  <span className="text-xs tabular-nums text-ink/45">{issue.ticket}</span>
                  {SOURCE_META[issue.source] && (
                    <span className="inline-flex items-center gap-1 self-center rounded-full bg-ink/6 px-2 py-0.5 text-[11px] font-medium text-ink/60">
                      {issue.source === "field_inspection" ? <ClipboardPen size={11} aria-hidden /> : <Headset size={11} aria-hidden />}
                      {SOURCE_META[issue.source]!.short}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-sm text-ink/65">{issue.address || issue.description}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/55">
                  <span className="inline-flex items-center gap-1">
                    <Layers size={13} aria-hidden /> {issue.reportCount} {issue.reportCount === 1 ? "report" : "reports"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ThumbsUp size={13} aria-hidden /> {issue.supporterCount}
                  </span>
                  {open && (
                    <span className="inline-flex items-center gap-1">
                      <Clock size={13} aria-hidden /> {daysOpen(issue.createdAt)}d open
                    </span>
                  )}
                </span>
              </span>
              <span className="hidden w-32 shrink-0 sm:block">
                <PriorityMeter score={issue.priority} label={issue.priorityLabel} />
              </span>
              <StatusBadge status={issue.status} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
