import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, CircleDot, FilePlus2, Hammer, Inbox, Layers } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { CountUp } from "../components/CountUp";
import { IssueList } from "../components/IssueList";
import { EmptyState, ErrorNote, ListSkeleton } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { OPEN } from "../lib/constants";
import type { Issue } from "../types";
import CommandCenter from "./CommandCenter";
import FieldDesk from "./FieldDesk";

const REPORT_CTA = { citizen: "Report an issue", officer: "Log field inspection", admin: "Register a complaint" };

const heading = { citizen: "Your latest reports", officer: "Assigned to you", admin: "Highest priority right now" };

function Tile({ label, value, icon: Icon, tone, bg }: { label: string; value: number; icon: typeof Layers; tone: string; bg: string }) {
  return (
    <div className="card card-hover p-5">
      <span className={`grid size-10 place-items-center rounded-xl ${bg} ${tone}`}><Icon size={20} aria-hidden /></span>
      <p className={`mt-4 font-display text-4xl font-bold ${tone}`}><CountUp value={value} /></p>
      <p className="mt-1 text-sm text-ink/60">{label}</p>
    </div>
  );
}

// Each role gets its own workspace on /dashboard.
export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === "officer") return <FieldDesk />;
  if (user?.role === "admin") return <CommandCenter />;
  return <CitizenHome />;
}

function CitizenHome() {
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
  const rate = list.length ? Math.round((resolved / list.length) * 100) : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl bg-signboard p-6 text-white animate-rise sm:p-8">
        <div className="grid-paper pointer-events-none absolute inset-0 opacity-25 [mask-image:linear-gradient(to_left,black,transparent_75%)]" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm text-white/70">{greeting},</p>
            <h1 className="mt-1 text-4xl font-semibold">{user.name}</h1>
            <p className="mt-2 text-sm text-white/70">
              {user.role === "officer" && user.department ? `${user.department} department` : `Signed in as ${user.role}`}
              {issues && ` · ${rate}% of your issues are resolved`}
            </p>
          </div>
          <Link to="/report" className="btn btn-marker !px-5 !py-3">
            <FilePlus2 size={18} aria-hidden /> {REPORT_CTA[user.role]}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Total" value={list.length} icon={Layers} tone="text-ink" bg="bg-ink/8" />
        <Tile label="Open" value={open} icon={CircleDot} tone="text-accent" bg="bg-accent/12" />
        <Tile label="In progress" value={inProgress} icon={Hammer} tone="text-marker-dark" bg="bg-marker/20" />
        <Tile label="Resolved" value={resolved} icon={BadgeCheck} tone="text-resolved" bg="bg-resolved/15" />
      </div>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{heading[user.role]}</h2>
          <Link to={user.role === "citizen" ? "/my-reports" : "/issues"} className="inline-flex items-center gap-1 text-sm font-semibold text-accent">
            View all <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
        <div className="mt-4">
          {error ? (
            <ErrorNote>{error}</ErrorNote>
          ) : issues === null ? (
            <ListSkeleton rows={4} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={user.role === "citizen" ? "Nothing reported yet" : "Nothing here yet"}
              text={user.role === "citizen" ? "Spot a pothole, garbage pile or dead street light? Report it and follow the fix." : "Issues will appear here as they are assigned."}
              action={user.role === "citizen" ? <Link to="/report" className="btn btn-primary">Report your first issue</Link> : undefined}
            />
          ) : (
            <IssueList issues={list.slice(0, 5)} empty="" />
          )}
        </div>
      </section>
    </div>
  );
}
