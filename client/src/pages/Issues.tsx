import { useEffect, useMemo, useState } from "react";
import { Inbox, SearchX } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { IssueFilterBar } from "../components/IssueFilterBar";
import { IssueList } from "../components/IssueList";
import { EmptyState, ErrorNote, ListSkeleton, PageHeader } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { applyFilters, groupCounts, type IssueFilters } from "../lib/issueFilters";
import type { Issue } from "../types";

const START: IssueFilters = { q: "", group: "open", category: "", sort: "priority" };

export default function Issues() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<IssueFilters>(START);

  const isOfficer = user?.role === "officer";

  useEffect(() => {
    const path = isOfficer ? "/issues/assigned" : "/issues";
    let active = true;
    api<{ issues: Issue[] }>(path)
      .then((data) => active && setIssues(data.issues))
      .catch((err) => active && setError(err instanceof ApiError ? err.message : "Could not load issues"));
    return () => {
      active = false;
    };
  }, [isOfficer]);

  const all = useMemo(() => issues ?? [], [issues]);
  // Tab counts follow the search box and category, so they always add up to what you can see.
  const counts = useMemo(() => groupCounts(applyFilters(all, { ...filters, group: "all" })), [all, filters]);
  const visible = useMemo(() => applyFilters(all, filters), [all, filters]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={isOfficer ? "Your queue" : "All issues"}
        subtitle={isOfficer ? "Issues assigned to you. Open ones first, highest priority on top." : "Every issue in the city. Open ones first, highest priority on top."}
      />
      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : issues === null ? (
        <ListSkeleton rows={6} />
      ) : issues.length === 0 ? (
        <EmptyState icon={Inbox} title={isOfficer ? "No issues assigned yet" : "No issues yet"} text="Issues will appear here as soon as they come in." />
      ) : (
        <>
          <IssueFilterBar value={filters} onChange={setFilters} counts={counts} shown={visible.length} total={all.length} placeholder="Search ticket, place, description or officer" />
          {visible.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No issues match these filters"
              text="Try another word or a different status tab."
              action={<button type="button" onClick={() => setFilters({ ...START, group: "all" })} className="btn btn-outline">Show everything</button>}
            />
          ) : (
            <IssueList issues={visible} empty="" />
          )}
        </>
      )}
    </div>
  );
}
