import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { IssueList } from "../components/IssueList";
import { api, ApiError } from "../lib/api";
import { CATEGORIES, STATUS_META } from "../lib/constants";
import type { Issue, Status } from "../types";

const selectClass = "rounded border border-ink/25 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-signboard";

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

  const visible = (issues ?? []).filter(
    (i) => (!status || i.status === status) && (!category || i.category === category),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{isOfficer ? "Your queue" : "All issues"}</h1>
      <p className="mt-1 text-sm text-ink/60">Sorted by priority, highest first.</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass} aria-label="Status">
          <option value="">All statuses</option>
          {(Object.keys(STATUS_META) as Status[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={selectClass}
          aria-label="Category"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        {error ? (
          <p className="text-sm text-alert">{error}</p>
        ) : issues === null ? (
          <p className="text-sm text-ink/60">Loading…</p>
        ) : (
          <IssueList
            issues={visible}
            empty={isOfficer ? "No issues are assigned to you yet." : "No issues match these filters."}
          />
        )}
      </div>
    </div>
  );
}
