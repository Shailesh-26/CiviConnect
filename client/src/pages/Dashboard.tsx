import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FilePlus2 } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { IssueList } from "../components/IssueList";
import { api, ApiError } from "../lib/api";
import { OPEN } from "../lib/constants";
import type { Issue } from "../types";

const heading = {
  citizen: "Your reports",
  officer: "Assigned to you",
  admin: "Highest priority issues",
};

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-ink/15 bg-white p-4">
      <p className="text-sm text-ink/60">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const role = user?.role;
  useEffect(() => {
    if (!role) return;
    const path = role === "citizen" ? "/issues/mine" : role === "officer" ? "/issues/assigned" : "/issues";
    let active = true;
    api<{ issues: Issue[] }>(path)
      .then((data) => active && setIssues(data.issues))
      .catch((err) => active && setError(err instanceof ApiError ? err.message : "Could not load issues"));
    return () => {
      active = false;
    };
  }, [role]);

  if (!user) return null;

  const list = issues ?? [];
  const open = list.filter((i) => OPEN.includes(i.status)).length;
  const inProgress = list.filter((i) => i.status === "in_progress").length;
  const resolved = list.filter((i) => i.status === "resolved").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {user.role === "officer" && user.department ? `${user.department} department` : `Signed in as ${user.role}`}
          </p>
        </div>
        <Link
          to="/report"
          className="inline-flex items-center gap-2 rounded-md bg-signboard px-4 py-2 font-medium text-white hover:bg-signboard/90"
        >
          <FilePlus2 size={18} aria-hidden /> Report an issue
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Total" value={list.length} tone="text-ink" />
        <Tile label="Open" value={open} tone="text-signboard" />
        <Tile label="In progress" value={inProgress} tone="text-marker-dark" />
        <Tile label="Resolved" value={resolved} tone="text-resolved" />
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{heading[user.role]}</h2>
        <Link
          to={user.role === "citizen" ? "/my-reports" : "/issues"}
          className="inline-flex items-center gap-1 text-sm font-medium text-signboard"
        >
          View all <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
      <div className="mt-3">
        {error ? (
          <p className="text-sm text-alert">{error}</p>
        ) : issues === null ? (
          <p className="text-sm text-ink/60">Loading…</p>
        ) : (
          <IssueList
            issues={list.slice(0, 5)}
            empty={user.role === "citizen" ? "You have not reported anything yet." : "Nothing here yet."}
          />
        )}
      </div>
    </div>
  );
}
