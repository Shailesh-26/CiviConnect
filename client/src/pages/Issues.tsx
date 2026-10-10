import { useState } from "react";
import { Inbox, SearchX } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { IssueFilterBar } from "../components/IssueFilterBar";
import { IssueList } from "../components/IssueList";
import { Pagination } from "../components/Pagination";
import { EmptyState, ErrorNote, ListSkeleton, PageHeader } from "../components/ui";
import type { IssueFilters } from "../lib/issueFilters";
import { usePagedIssues } from "../lib/usePagedIssues";

const START: IssueFilters = { q: "", group: "open", category: "", sort: "priority" };

export default function Issues() {
  const { user } = useAuth();
  const isOfficer = user?.role === "officer";
  const [filters, setFiltersRaw] = useState<IssueFilters>(START);
  const [page, setPage] = useState(1);
  const setFilters = (f: IssueFilters) => {
    setFiltersRaw(f);
    setPage(1);
  };
  const { data, error, loading } = usePagedIssues(isOfficer ? "/issues/assigned" : "/issues", filters, page, 20);

  return (
    <div className="space-y-6">
      <PageHeader
        title={isOfficer ? "Your queue" : "All issues"}
        subtitle={`${isOfficer ? "Issues assigned to you" : "Every issue in the city"}. Searched, filtered, sorted and paged on the server, so it stays fast as the city grows.`}
      />
      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : !data ? (
        <ListSkeleton rows={6} />
      ) : data.counts.all === 0 ? (
        <EmptyState icon={Inbox} title={isOfficer ? "No issues assigned yet" : "No issues yet"} text="Issues will appear here as soon as they come in." />
      ) : (
        <>
          <IssueFilterBar value={filters} onChange={setFilters} counts={data.counts} shown={data.total} total={data.counts.all} placeholder="Search ticket, place, problem or description" />
          <div className={`transition-opacity ${loading ? "opacity-50" : ""}`}>
            {data.issues.length === 0 ? (
              <EmptyState icon={SearchX} title="No issues match these filters" text="Try another word or a different status tab." action={<button type="button" onClick={() => setFilters({ ...START, group: "all" })} className="btn btn-outline">Show everything</button>} />
            ) : (
              <IssueList issues={data.issues} empty="" />
            )}
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        </>
      )}
    </div>
  );
}
