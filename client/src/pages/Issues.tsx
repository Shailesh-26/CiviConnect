import { useEffect, useState } from "react";
import { SearchX } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { IssueList } from "../components/IssueList";
import { EmptyState, ErrorNote, ListSkeleton, PageHeader } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { CATEGORIES, STATUS_META } from "../lib/constants";
import type { Issue, Status } from "../types";

export default function Issues() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");

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

  const visible = (issues ?? []).filter((i) => (!status || i.status === status) && (!category || i.category === category));
  const filtered = Boolean(status || category);

  return (
    <div className="space-y-6">
      <PageHeader
        title={isOfficer ? "Your queue" : "All issues"}
        subtitle={`Sorted by priority, highest first.${issues ? ` Showing ${visible.length} of ${issues.length}.` : ""}`}
      />

      <div className="flex flex-wrap gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input !w-auto !py-2 text-sm" aria-label="Status">
          <option value="">All statuses</option>
          {(Object.keys(STATUS_META) as Status[]).map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input !w-auto !py-2 text-sm" aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        {filtered && (
          <button onClick={() => { setStatus(""); setCategory(""); }} className="btn btn-ghost !py-2 text-sm">Clear filters</button>
        )}
      </div>

      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : issues === null ? (
        <ListSkeleton rows={6} />
      ) : visible.length === 0 ? (
        <EmptyState icon={SearchX} title={isOfficer && !filtered ? "No issues assigned yet" : "No issues match these filters"} text="Try changing or clearing the filters." />
      ) : (
        <IssueList issues={visible} empty="" />
      )}
    </div>
  );
}
