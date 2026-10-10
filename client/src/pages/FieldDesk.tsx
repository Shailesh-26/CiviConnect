import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, ClipboardPen, Flame, Hammer, Hourglass, MapPin, Navigation, Play, Route, Timer, Wrench } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { CategoryChip } from "../components/CategoryChip";
import { CountUp } from "../components/CountUp";
import { Ring } from "../components/Ring";
import { RouteMap } from "../components/RouteMap";
import { SlaChip } from "../components/SlaChip";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState, ErrorNote, Skeleton } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { issueLabel } from "../lib/constants";
import { formatDuration, timeAgo } from "../lib/format";
import { planRoute } from "../lib/route";
import { useLiveRefresh } from "../lib/useLiveRefresh";
import { useToast } from "../lib/toast-context";
import type { DeskData, Issue } from "../types";

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Timer; tone: string }) {
  return (
    <div className="card card-hover tilt p-4">
      <span className={`grid size-9 place-items-center rounded-xl ${tone}`}><Icon size={18} aria-hidden /></span>
      <p className="mt-3 font-display text-3xl font-bold"><CountUp value={value} /></p>
      <p className="text-xs text-ink/60">{label}</p>
    </div>
  );
}

// The officer's workspace: today's work sorted by time left, the day's route, and how they are doing.
export default function FieldDesk() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<DeskData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api<DeskData>("/officer/desk")
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load your desk"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useLiveRefresh(load);

  async function start(issue: Issue) {
    setBusyId(issue.id);
    const form = new FormData();
    form.append("status", "in_progress");
    form.append("note", "Work started on site.");
    try {
      await api(`/issues/${issue.id}/status`, { method: "PATCH", body: form });
      toast.success("Citizens following it were told work has started.", { title: `${issue.ticket} in progress` });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  const route = useMemo(() => planRoute(data?.queue.slice(0, 8) ?? []), [data]);

  if (!user) return null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-40 !rounded-3xl md:col-span-2" />
        <Skeleton className="h-40 !rounded-3xl" />
        <Skeleton className="h-40 !rounded-3xl" />
        <Skeleton className="h-96 !rounded-3xl md:col-span-4" />
      </div>
    );
  }

  const s = data.stats;
  const summary =
    s.open === 0
      ? "Your queue is clear. Nice work."
      : `${s.open} open ${s.open === 1 ? "issue" : "issues"}${s.breached ? `, ${s.breached} overdue` : ""}${s.dueToday ? `, ${s.dueToday} due within a day` : ""}.`;

  return (
    <div className="space-y-6">
      {/* Bento: hero + key numbers */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="relative overflow-hidden rounded-3xl bg-signboard p-6 text-white animate-rise md:col-span-2 md:row-span-2 sm:p-7">
          <div className="grid-paper pointer-events-none absolute inset-0 opacity-25 [mask-image:linear-gradient(to_left,black,transparent_80%)]" aria-hidden />
          <div className="relative flex h-full flex-col">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/60"><Wrench size={14} aria-hidden /> Field Desk · {user.department ?? "Officer"}</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{greeting}, {user.name.split(" ")[0]}</h1>
            <p className="mt-2 text-white/75">{summary}</p>
            <div className="mt-auto flex flex-wrap gap-2 pt-6">
              {data.queue[0] && (
                <Link to={`/issues/${data.queue[0].id}`} className="btn btn-marker">
                  <Navigation size={16} aria-hidden /> Start with {data.queue[0].ticket}
                </Link>
              )}
              <Link to="/report" className="btn bg-white/12 text-white hover:bg-white/20"><ClipboardPen size={16} aria-hidden /> Log inspection</Link>
            </div>
          </div>
        </div>
        <Stat label="Open on your desk" value={s.open} icon={Hammer} tone="bg-accent/12 text-accent" />
        <Stat label="Overdue" value={s.breached} icon={Flame} tone="bg-alert/12 text-alert" />
        <Stat label="Due within 24 h" value={s.dueToday} icon={Hourglass} tone="bg-marker/20 text-marker-dark" />
        <Stat label="Fixed this week" value={s.resolvedWeek} icon={BadgeCheck} tone="bg-resolved/15 text-resolved" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold">Next up</h2>
              <p className="text-sm text-ink/55">Sorted by time left on the fix-by clock.</p>
            </div>
            <Link to="/issues" className="inline-flex items-center gap-1 text-sm font-semibold text-accent">Full queue <ArrowRight size={15} aria-hidden /></Link>
          </div>
          {data.queue.length === 0 ? (
            <EmptyState icon={BadgeCheck} title="Nothing waiting" text="New assignments will appear here the moment an admin assigns them." />
          ) : (
            <ol className="space-y-3">
              {data.queue.slice(0, 10).map((issue, i) => (
                <li key={issue.id} className="card card-hover flex items-center gap-4 p-4 animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold ${issue.sla.state === "breached" ? "bg-alert text-white" : "bg-ink/8"}`}>{i + 1}</span>
                  <CategoryChip category={issue.category} icon={issue.customIcon} size="sm" />
                  <Link to={`/issues/${issue.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-semibold hover:text-accent">{issueLabel(issue)} <span className="text-xs font-normal text-ink/45">{issue.ticket}</span></p>
                    <p className="flex items-center gap-1 truncate text-xs text-ink/55"><MapPin size={12} aria-hidden /> {issue.address ?? "No landmark given"}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-2">
                      <SlaChip sla={issue.sla} />
                      <StatusBadge status={issue.status} />
                      {issue.escalated && <span className="rounded-full bg-alert/10 px-2 py-0.5 text-[11px] font-semibold text-alert">Escalated</span>}
                    </p>
                  </Link>
                  {issue.status === "acknowledged" ? (
                    <button type="button" onClick={() => start(issue)} disabled={busyId === issue.id} className="btn btn-primary shrink-0 !px-3 !py-2 text-xs">
                      <Play size={14} aria-hidden /> {busyId === issue.id ? "Starting…" : "Start work"}
                    </button>
                  ) : (
                    <Link to={`/issues/${issue.id}`} className="btn btn-outline shrink-0 !px-3 !py-2 text-xs">
                      <BadgeCheck size={14} aria-hidden /> Resolve
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="min-w-0 space-y-4">
          <div className="card overflow-hidden p-2">
            <div className="flex items-center justify-between px-3 pb-2 pt-2">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold"><Route size={17} className="text-accent" aria-hidden /> Today's route</h2>
              <span className="text-xs text-ink/55">{route.order.length} stops · ~{route.totalKm.toFixed(1)} km</span>
            </div>
            {route.order.length ? <RouteMap stops={route.order} className="h-80" /> : <div className="grid h-60 place-items-center text-sm text-ink/50">No stops today</div>}
            <p className="px-3 pb-2 pt-2 text-[11px] text-ink/50">Starts at your most urgent issue, then always the nearest next stop.</p>
          </div>
          <div className="card flex items-center gap-5 p-5">
            <Ring value={s.onTimeRate} label={`On time: ${s.onTimeRate ?? "no data"}%`} />
            <div>
              <p className="text-sm font-semibold">Fixed on time</p>
              <p className="text-xs text-ink/55">Last 90 days · {s.resolved90d} fixed</p>
              <p className="mt-2 text-sm"><span className="font-semibold">{formatDuration(s.avgFixHours)}</span> <span className="text-ink/55">average fix time</span></p>
            </div>
          </div>
          {data.recent.length > 0 && (
            <div className="card p-5">
              <h2 className="font-display text-base font-semibold">Recently fixed</h2>
              <ul className="mt-3 space-y-2.5">
                {data.recent.map((r) => (
                  <li key={r.id}>
                    <Link to={`/issues/${r.id}`} className="flex items-center gap-3 text-sm hover:text-accent">
                      <CategoryChip category={r.category} icon={r.customIcon} size="sm" />
                      <span className="min-w-0 flex-1 truncate">{issueLabel(r)} · {r.ticket}</span>
                      <span className="text-xs text-ink/50">{r.resolvedAt ? timeAgo(r.resolvedAt) : ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
