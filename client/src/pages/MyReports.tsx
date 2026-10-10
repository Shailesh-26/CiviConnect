import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FilePlus2, Inbox } from "lucide-react";
import { IssueList } from "../components/IssueList";
import { EmptyState, ErrorNote, ListSkeleton, PageHeader } from "../components/ui";
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
        <IssueList issues={issues} empty="" />
      )}
    </div>
  );
}
