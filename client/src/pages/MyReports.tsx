import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IssueList } from "../components/IssueList";
import { api, ApiError } from "../lib/api";
import type { Issue } from "../types";

export default function MyReports() {
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api<{ issues: Issue[] }>("/issues/mine")
      .then((data) => active && setIssues(data.issues))
      .catch((err) => active && setError(err instanceof ApiError ? err.message : "Could not load your reports"));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">My reports</h1>
      <div className="mt-6">
        {error ? (
          <p className="text-sm text-alert">{error}</p>
        ) : issues === null ? (
          <p className="text-sm text-ink/60">Loading…</p>
        ) : (
          <IssueList
            issues={issues}
            empty="You have not reported anything yet."
          />
        )}
      </div>
      {issues?.length === 0 && (
        <Link to="/report" className="mt-4 inline-block text-sm font-medium text-signboard underline">
          Report your first issue
        </Link>
      )}
    </div>
  );
}
