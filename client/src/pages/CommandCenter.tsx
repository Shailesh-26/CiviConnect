import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Flag,
  Flame,
  GripVertical,
  Hourglass,
  Inbox,
  Radio,
  Sparkles,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "../components/Avatar";
import { CategoryChip } from "../components/CategoryChip";
import { CommandMap } from "../components/CommandMap";
import { CountUp } from "../components/CountUp";
import { SimulatorControl } from "../components/SimulatorControl";
import { SlaChip } from "../components/SlaChip";
import { ErrorNote, Skeleton } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { issueLabel, PRIORITY_META } from "../lib/constants";
import { timeAgo } from "../lib/format";
import { useNotifications } from "../lib/notification-context";
import { useLiveRefresh } from "../lib/useLiveRefresh";
import { useToast } from "../lib/toast-context";
import type { CommandOverview, Issue, Suggestion } from "../types";

const CAPACITY = 10;

function Kpi({ label, value, icon: Icon, tone, to }: { label: string; value: number; icon: LucideIcon; tone: string; to?: string }) {
  const body = (
    <>
      <span className={`grid size-9 place-items-center rounded-xl ${tone}`}><Icon size={18} aria-hidden /></span>
      <p className="mt-3 font-display text-3xl font-bold"><CountUp value={value} /></p>
      <p className="text-xs text-ink/60">{label}</p>
    </>
  );
  return to ? <Link to={to} className="card card-hover tilt block p-4">{body}</Link> : <div className="card card-hover tilt p-4">{body}</div>;
}

function BoardCard({ issue, suggestion, onAssign, busy }: { issue: Issue; suggestion?: Suggestion; onAssign?: (officerId: string) => void; busy: boolean }) {
  return (
    <div
      draggable={!busy}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/issue", issue.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`group rounded-2xl border border-ink/10 bg-surface p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift ${busy ? "opacity-50" : "cursor-grab active:cursor-grabbing"}`}
    >
      <div className="flex items-start gap-2.5">
        <CategoryChip category={issue.category} icon={issue.customIcon} size="sm" />
        <Link to={`/issues/${issue.id}`} className="min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
          <p className="truncate text-sm font-semibold hover:text-accent">{issueLabel(issue)}</p>
          <p className="truncate text-[11px] text-ink/50">{issue.ticket} · {issue.address ?? "No landmark"}</p>
        </Link>
        <GripVertical size={16} className="mt-1 shrink-0 text-ink/25 group-hover:text-ink/50" aria-hidden />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <SlaChip sla={issue.sla} compact />
        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${PRIORITY_META[issue.priorityLabel].hex}1f`, color: PRIORITY_META[issue.priorityLabel].hex }}>
          {issue.priority}
        </span>
      </div>
      {suggestion && onAssign && (
        <button type="button" disabled={busy} onClick={() => onAssign(suggestion.id)} className="mt-2.5 flex w-full items-center gap-2 rounded-xl bg-accent/8 px-2.5 py-1.5 text-left text-xs transition hover:bg-accent/15">
          <Sparkles size={13} className="shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 flex-1 truncate"><span className="font-semibold text-accent">Assign to {suggestion.name}</span> <span className="text-ink/50">· {suggestion.reason}</span></span>
        </button>
      )}
    </div>
  );
}

// The admin's live view of the whole city: what is late, who is free, and what just happened.
export default function CommandCenter() {
  const toast = useToast();
  const { connected } = useNotifications();
  const [data, setData] = useState<CommandOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [over, setOver] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  // Show the arrow buttons only when there is more to scroll to on that side.
  const updateEdges = useCallback(() => {
    const el = lanesRef.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  const scrollLanes = (dir: number) => lanesRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });

  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [updateEdges, data]);

  const load = useCallback(() => {
    api<CommandOverview>("/admin/overview")
      .then((d) => {
        setData(d);
        setError(null);
        setUpdatedAt(new Date());
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load the Command Center"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useLiveRefresh(load, 45_000);

  async function assign(issueId: string, officerId: string) {
    if (!data) return;
    const officer = data.lanes.find((l) => l.officer.id === officerId);
    const issue = data.unassigned.find((i) => i.id === issueId) ?? data.lanes.flatMap((l) => l.issues).find((i) => i.id === issueId);
    if (!officer || !issue || issue.assignedTo?.id === officerId) return;
    setBusy((b) => new Set(b).add(issueId));
    // Move the card right away; the server confirms in the background.
    setData((d) =>
      d && {
        ...d,
        unassigned: d.unassigned.filter((i) => i.id !== issueId),
        lanes: d.lanes.map((l) =>
          l.officer.id === officerId
            ? { ...l, open: l.open + 1, issues: [{ ...issue, assignedTo: { id: officerId, name: officer.officer.name, department: officer.officer.department } }, ...l.issues] }
            : { ...l, issues: l.issues.filter((i) => i.id !== issueId), open: l.issues.some((i) => i.id === issueId) ? l.open - 1 : l.open },
        ),
        kpis: { ...d.kpis, unassigned: d.unassigned.some((i) => i.id === issueId) ? d.kpis.unassigned - 1 : d.kpis.unassigned },
      },
    );
    try {
      await api(`/issues/${issueId}/assign`, { method: "PATCH", body: { officerId } });
      toast.success(`${officer.officer.name} has been notified.`, { title: `${issue.ticket} assigned` });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not assign. Try again.");
      load();
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(issueId);
        return next;
      });
    }
  }

  const dropProps = (officerId: string) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setOver(officerId);
    },
    onDragLeave: () => setOver((o) => (o === officerId ? null : o)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setOver(null);
      const id = e.dataTransfer.getData("text/issue");
      if (id) void assign(id, officerId);
    },
  });

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) {
    return (
      <div className="grid gap-4 md:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28 !rounded-2xl" />)}
        <Skeleton className="h-[26rem] !rounded-3xl md:col-span-4" />
        <Skeleton className="h-[26rem] !rounded-3xl md:col-span-2" />
      </div>
    );
  }

  const k = data.kpis;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 animate-rise">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent"><Radio size={14} aria-hidden /> Command Center</p>
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">The city right now</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <SimulatorControl />
        <p className="flex items-center gap-2 rounded-full border border-ink/10 bg-surface px-3 py-1.5 text-xs text-ink/60">
          <span className="relative flex size-2.5">
            {connected && <span className="absolute inline-flex size-full animate-ping rounded-full bg-resolved opacity-70" />}
            <span className={`relative inline-flex size-2.5 rounded-full ${connected ? "bg-resolved" : "bg-ink/30"}`} />
          </span>
          {connected ? "Live" : "Reconnecting"} · updated {updatedAt ? timeAgo(updatedAt) : "now"}
        </p>
        </div>
      </div>

      {/* Bento: KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Open issues" value={k.open} icon={CircleDot} tone="bg-accent/12 text-accent" />
        <Kpi label="Waiting for an officer" value={k.unassigned} icon={Inbox} tone="bg-marker/20 text-marker-dark" />
        <Kpi label="Overdue" value={k.breached} icon={Flame} tone="bg-alert/12 text-alert" />
        <Kpi label="Due within 24 h" value={k.dueSoon} icon={Hourglass} tone="bg-marker/20 text-marker-dark" />
        <Kpi label="Fixed in 7 days" value={k.resolved7d} icon={BadgeCheck} tone="bg-resolved/15 text-resolved" />
        <Kpi label="Flags to review" value={k.flagsOpen} icon={Flag} tone="bg-alert/12 text-alert" to="/admin?tab=moderation" />
      </div>

      {/* Bento: map + breach board */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="card min-w-0 overflow-hidden p-2">
          <CommandMap pins={data.pins} className="h-[27rem]" />
        </div>
        <section className="card flex max-h-[28.5rem] min-w-0 flex-col p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><TriangleAlert size={18} className="text-alert" aria-hidden /> Breach board</h2>
          <p className="text-xs text-ink/55">Overdue first, then the ones about to be.</p>
          <ul className="cc-scroll mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
            {data.breachBoard.length === 0 ? (
              <li className="py-10 text-center text-sm text-ink/50">Everything is on time. 🎉</li>
            ) : (
              data.breachBoard.map((i) => (
                <li key={i.id}>
                  <Link to={`/issues/${i.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-ink/5">
                    <CategoryChip category={i.category} icon={i.customIcon} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{issueLabel(i)} <span className="font-normal text-ink/45">{i.ticket}</span></span>
                      <span className="block truncate text-[11px] text-ink/50">{i.assignedTo ? i.assignedTo.name : "Unassigned"} · {i.address ?? ""}</span>
                    </span>
                    <SlaChip sla={i.sla} compact />
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      {/* Assignment board */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold"><UserPlus size={19} className="text-accent" aria-hidden /> Assignment board</h2>
            <p className="text-sm text-ink/55">Drag a card onto an officer, or use the suggestion. Suggestions weigh past work in that category, department and current load.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row">
          {/* The Unassigned lane stays put; only the officer lanes scroll sideways. */}
          <div className="flex w-full shrink-0 flex-col rounded-3xl border-2 border-dashed border-marker/50 bg-marker/[0.06] p-3 lg:w-80">
            <p className="flex items-center justify-between px-1 pb-3 text-sm font-semibold">
              <span className="flex items-center gap-2"><Inbox size={16} className="text-marker-dark" aria-hidden /> Unassigned</span>
              <span className="rounded-full bg-marker/25 px-2 text-xs tabular-nums text-marker-dark">{k.unassigned}</span>
            </p>
            <div className="cc-scroll max-h-[34rem] space-y-2.5 overflow-y-auto pr-1">
              {data.unassigned.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-ink/50">All issues have an officer.</p>
              ) : (
                data.unassigned.map((i) => <BoardCard key={i.id} issue={i} suggestion={i.suggestion} busy={busy.has(i.id)} onAssign={(o) => assign(i.id, o)} />)
              )}
            </div>
          </div>

          <div className="relative min-w-0 flex-1">
            <div ref={lanesRef} onScroll={updateEdges} className="cc-scroll flex gap-4 overflow-x-auto scroll-smooth pb-3 [scroll-snap-type:x_proximity]">
          {data.lanes.map((lane) => {
            const load = Math.min(1, lane.open / CAPACITY);
            return (
              <div
                key={lane.officer.id}
                {...dropProps(lane.officer.id)}
                className={`flex w-72 shrink-0 snap-start flex-col rounded-3xl border p-3 transition ${over === lane.officer.id ? "scale-[1.01] border-accent bg-accent/8 shadow-lift" : "border-ink/10 bg-ink/[0.03]"}`}
              >
                <div className="flex items-center gap-2.5 px-1">
                  <Avatar name={lane.officer.name} avatar={lane.officer.avatar} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{lane.officer.name}</p>
                    <p className="truncate text-[11px] text-ink/50">{lane.officer.department ?? "Officer"}</p>
                  </div>
                  {lane.breached > 0 && <span className="rounded-full bg-alert/12 px-2 py-0.5 text-[11px] font-semibold text-alert">{lane.breached} late</span>}
                </div>
                <div className="mt-3 px-1">
                  <div className="flex justify-between text-[11px] text-ink/55">
                    <span>Workload {lane.open}/{CAPACITY}</span>
                    <span>{lane.resolved30d} fixed in 30 d</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10">
                    <div className={`h-full rounded-full transition-all ${load > 0.8 ? "bg-alert" : load > 0.5 ? "bg-marker" : "bg-resolved"}`} style={{ width: `${load * 100}%` }} />
                  </div>
                </div>
                <div className="cc-scroll mt-3 max-h-[30rem] min-h-24 space-y-2.5 overflow-y-auto pr-1">
                  {lane.issues.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-ink/15 px-3 py-6 text-center text-xs text-ink/45">Free. Drop an issue here.</p>
                  ) : (
                    lane.issues.map((i) => <BoardCard key={i.id} issue={i} busy={busy.has(i.id)} />)
                  )}
                </div>
              </div>
            );
          })}
            </div>
            {edges.left && (
              <>
                <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-paper to-transparent" aria-hidden />
                <button type="button" onClick={() => scrollLanes(-1)} aria-label="Scroll officers left" className="absolute left-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-ink/10 bg-surface/90 shadow-lift backdrop-blur transition hover:scale-110"><ChevronLeft size={19} aria-hidden /></button>
              </>
            )}
            {edges.right && (
              <>
                <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-paper to-transparent" aria-hidden />
                <button type="button" onClick={() => scrollLanes(1)} aria-label="Scroll officers right" className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-ink/10 bg-surface/90 shadow-lift backdrop-blur transition hover:scale-110"><ChevronRight size={19} aria-hidden /></button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Live activity */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Activity size={18} className="text-accent" aria-hidden /> Live activity</h2>
        <ul className="mt-3 divide-y divide-ink/8">
          {data.activity.map((a) => (
            <li key={a.id} className="flex items-start gap-3 py-2.5 text-sm">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.actorRole === "system" ? "bg-alert" : a.actorRole === "officer" ? "bg-accent" : "bg-marker"}`} />
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{a.actorName}</span> <span className="text-ink/70">{a.summary}</span>
              </span>
              <span className="shrink-0 text-xs text-ink/45">{timeAgo(a.at)}</span>
            </li>
          ))}
          {data.activity.length === 0 && <li className="py-6 text-center text-sm text-ink/50">No activity yet.</li>}
        </ul>
        <Link to="/admin?tab=audit" className="mt-2 inline-block text-sm font-semibold text-accent">Full audit log</Link>
      </section>
    </div>
  );
}
