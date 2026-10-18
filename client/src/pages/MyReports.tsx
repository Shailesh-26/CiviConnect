import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FilePlus2, Inbox, SearchX } from "lucide-react";
import { IssueFilterBar } from "../components/IssueFilterBar";
import { IssueList } from "../components/IssueList";
import { Pagination } from "../components/Pagination";
import { EmptyState, ErrorNote, ListSkeleton, PageHeader } from "../components/ui";
import { STATUS_GROUPS, type IssueFilters, type StatusGroup } from "../lib/issueFilters";
import { usePagedIssues } from "../lib/usePagedIssues";

const START: IssueFilters = { q: "", group: "all", category: "", sort: "newest" };

export default function MyReports() {
  // The status filter lives in the address (?status=open), so the dashboard tiles can link
  // straight to a filtered list and the sidebar link shows everything again.
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get("status");
  const group = STATUS_GROUPS.some((g) => g.value === fromUrl) ? (fromUrl as StatusGroup) : "all";
  const [rest, setRest] = useState<Omit<IssueFilters, "group">>({ q: START.q, category: START.category, sort: START.sort });
  const filters: IssueFilters = { ...rest, group };
  const [paging, setPaging] = useState({ key: "", page: 1 });
  const filterKey = JSON.stringify(filters);
  const page = paging.key === filterKey ? paging.page : 1;
  const setPage = (p: number) => setPaging({ key: filterKey, page: p });
  const setFilters = (f: IssueFilters) => {
    setRest({ q: f.q, category: f.category, sort: f.sort });
    if (f.group !== group) setParams(f.group === "all" ? {} : { status: f.group }, { replace: true });
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
