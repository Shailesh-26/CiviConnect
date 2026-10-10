import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FilePlus2, Inbox, SearchX } from "lucide-react";
import { IssueFilterBar } from "../components/IssueFilterBar";
import { IssueList } from "../components/IssueList";
import { EmptyState, ErrorNote, ListSkeleton, PageHeader } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { applyFilters, groupCounts, type IssueFilters } from "../lib/issueFilters";
import type { Issue } from "../types";

const START: IssueFilters = { q: "", group: "all", category: "", sort: "newest" };

export default function MyReports() {
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<IssueFilters>(START);

  useEffect(() => {
    let active = true;
    api<{ issues: Issue[] }>("/issues/mine")
      .then((data) => active && setIssues(data.issues))
      .catch((err) => active && setError(err instanceof ApiError ? err.message : "Could not load your reports"));
    return () => {
      active = false;
    };
  }, []);

  const all = useMemo(() => issues ?? [], [issues]);
  // Tab counts follow the search box and category, so they always add up to what you can see.
  const counts = useMemo(() => groupCounts(applyFilters(all, { ...filters, group: "all" })), [all, filters]);
  const visible = useMemo(() => applyFilters(all, filters), [all, filters]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My reports"
        subtitle="Every problem you have reported, with its live status."
        action={<Link to="/report" className="btn btn-primary"><FilePlus2 size={17} aria-hidden /> New report</Link>}
      />
      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : issues === null ? (
        <ListSkeleton />
      ) : issues.length === 0 ? (
        <EmptyState icon={Inbox} title="You have not reported anything yet" text="Your reports and their progress will show up here." action={<Link to="/report" className="btn btn-primary">Report your first issue</Link>} />
      ) : (
        <>
          <IssueFilterBar value={filters} onChange={setFilters} counts={counts} shown={visible.length} total={all.length} />
          {visible.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No reports match"
              text="Try another word, or clear the filters to see all your reports."
              action={<button type="button" onClick={() => setFilters(START)} className="btn btn-outline">Clear filters</button>}
            />
          ) : (
            <IssueList issues={visible} empty="" />
          )}
        </>
      )}
    </div>
  );
}
