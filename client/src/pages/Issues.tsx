import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Inbox, SearchX, X } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { IssueFilterBar } from "../components/IssueFilterBar";
import { IssueList } from "../components/IssueList";
import { Pagination } from "../components/Pagination";
import { EmptyState, ErrorNote, ListSkeleton, PageHeader } from "../components/ui";
import { STATUS_GROUPS, type IssueFilters, type StatusGroup, type TimeFilter } from "../lib/issueFilters";
import { usePagedIssues } from "../lib/usePagedIssues";

const START: IssueFilters = { q: "", group: "open", category: "", sort: "priority" };
const WHEN_LABEL: Record<TimeFilter, string> = { overdue: "Overdue only", due24: "Due within 24 h", week: "Fixed in the last 7 days", unassigned: "Waiting for an officer" };

export default function Issues() {
  const { user } = useAuth();
  const isOfficer = user?.role === "officer";
  // Status and time filters live in the address (?status=open&when=overdue), so Field Desk tiles
  // can open the list already filtered, and the sidebar link shows the default view again.
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get("status");
  const group = STATUS_GROUPS.some((g) => g.value === fromUrl) ? (fromUrl as StatusGroup) : START.group;
  const whenParam = params.get("when");
  const when = whenParam && whenParam in WHEN_LABEL ? (whenParam as TimeFilter) : undefined;
  const [rest, setRest] = useState({ q: START.q, category: START.category, sort: START.sort });
  const filters: IssueFilters = { ...rest, group, when };
  const [paging, setPaging] = useState({ key: "", page: 1 });
  const filterKey = JSON.stringify(filters);
  const page = paging.key === filterKey ? paging.page : 1;
  const setPage = (p: number) => setPaging({ key: filterKey, page: p });

  const setUrl = (g: StatusGroup, w?: TimeFilter) => {
    const next: Record<string, string> = {};
    if (g !== START.group) next.status = g;
    if (w) next.when = w;
    setParams(next, { replace: true });
  };
  const setFilters = (f: IssueFilters) => {
    setRest({ q: f.q, category: f.category, sort: f.sort });
    if (f.group !== group) setUrl(f.group, undefined); // picking a status tab clears the time filter
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
      ) : data.counts.all === 0 && !when ? (
        <EmptyState icon={Inbox} title={isOfficer ? "No issues assigned yet" : "No issues yet"} text="Issues will appear here as soon as they come in." />
      ) : (
        <>
          <IssueFilterBar value={filters} onChange={setFilters} counts={data.counts} shown={data.total} total={data.counts.all} placeholder="Search ticket, place, problem or description" />
          {when && (
            <p className="flex flex-wrap items-center gap-2 text-sm animate-fade">
              Showing
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/12 py-1 pl-3 pr-1 font-semibold text-accent">
                {WHEN_LABEL[when]}
                <button type="button" onClick={() => setUrl(group, undefined)} aria-label="Remove this filter" className="grid size-6 place-items-center rounded-full hover:bg-accent/15"><X size={14} aria-hidden /></button>
              </span>
            </p>
          )}
          <div className={`transition-opacity ${loading ? "opacity-50" : ""}`}>
            {data.issues.length === 0 ? (
              when ? (
                <EmptyState icon={Inbox} title={when === "week" ? "Nothing fixed in the last 7 days" : when === "overdue" ? "Nothing overdue" : when === "unassigned" ? "Every open issue has an officer" : "Nothing due within a day"} text={when === "week" ? "Fixes you complete will appear here." : "Nice. Everything is on time."} action={<Link to="/issues" className="btn btn-outline">Show the whole queue</Link>} />
              ) : (
                <EmptyState icon={SearchX} title="No issues match these filters" text="Try another word or a different status tab." action={<button type="button" onClick={() => { setRest({ q: "", category: "", sort: START.sort }); setUrl("all"); }} className="btn btn-outline">Show everything</button>} />
              )
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
