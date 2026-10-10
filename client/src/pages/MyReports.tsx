import { useState } from "react";
import { Link } from "react-router-dom";
import { FilePlus2, Inbox, SearchX } from "lucide-react";
import { IssueFilterBar } from "../components/IssueFilterBar";
import { IssueList } from "../components/IssueList";
import { Pagination } from "../components/Pagination";
import { EmptyState, ErrorNote, ListSkeleton, PageHeader } from "../components/ui";
import type { IssueFilters } from "../lib/issueFilters";
import { usePagedIssues } from "../lib/usePagedIssues";

const START: IssueFilters = { q: "", group: "all", category: "", sort: "newest" };

export default function MyReports() {
  const [filters, setFiltersRaw] = useState<IssueFilters>(START);
  const [page, setPage] = useState(1);
  const setFilters = (f: IssueFilters) => {
    setFiltersRaw(f);
    setPage(1);
  };
  const { data, error, loading } = usePagedIssues("/issues/mine", filters, page);
  const filtered = Boolean(filters.q || filters.category || filters.group !== "all");

  return (
    <div className="space-y-6">
      <PageHeader
        title="My reports"
        subtitle="Every problem you have reported, with its live status."
        action={<Link to="/report" className="btn btn-primary"><FilePlus2 size={17} aria-hidden /> New report</Link>}
      />
      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : !data ? (
        <ListSkeleton />
      ) : data.counts.all === 0 && !filtered ? (
        <EmptyState icon={Inbox} title="You have not reported anything yet" text="Your reports and their progress will show up here." action={<Link to="/report" className="btn btn-primary">Report your first issue</Link>} />
      ) : (
        <>
          <IssueFilterBar value={filters} onChange={setFilters} counts={data.counts} shown={data.total} total={data.counts.all} />
          <div className={`transition-opacity ${loading ? "opacity-50" : ""}`}>
            {data.issues.length === 0 ? (
              <EmptyState icon={SearchX} title="No reports match" text="Try another word, or clear the filters to see all your reports." action={<button type="button" onClick={() => setFilters(START)} className="btn btn-outline">Clear filters</button>} />
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
