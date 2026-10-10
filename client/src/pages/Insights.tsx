import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  CalendarClock,
  Film,
  Gauge,
  Lightbulb,
  Pause,
  Play,
  Printer,
  Repeat,
  RotateCcw,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { CategoryChip } from "../components/CategoryChip";
import { EmptyState, ErrorNote, PageHeader, Skeleton } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { copyText } from "../lib/community";
import { CATEGORY_COLOR, categoryMeta, STATUS_META } from "../lib/constants";
import { formatDuration } from "../lib/format";
import { useToast } from "../lib/toast-context";
import type { AreaCard, ChronicSpot, Grade, TimelineItem } from "../types";

type Tab = "cards" | "chronic" | "replay";
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "cards", label: "Area report cards", icon: Award },
  { id: "chronic", label: "Chronic spots", icon: Repeat },
  { id: "replay", label: "City time-lapse", icon: Film },
];

const GRADE_TONE: Record<Grade, { bg: string; text: string; ring: string }> = {
  A: { bg: "bg-resolved/15", text: "text-resolved", ring: "var(--c-resolved)" },
  B: { bg: "bg-accent/15", text: "text-accent", ring: "var(--c-accent)" },
  C: { bg: "bg-marker/20", text: "text-marker-dark", ring: "var(--c-marker)" },
  D: { bg: "bg-[#eb6834]/15", text: "text-[#c2561f]", ring: "#eb6834" },
  F: { bg: "bg-alert/15", text: "text-alert", ring: "var(--c-alert)" },
};
const ORDER: Grade[] = ["F", "D", "C", "B", "A"];

function Bar({ label, value, good = true }: { label: string; value: number; good?: boolean }) {
  const tone = good ? (value >= 75 ? "bg-resolved" : value >= 50 ? "bg-marker" : "bg-alert") : value <= 10 ? "bg-resolved" : value <= 25 ? "bg-marker" : "bg-alert";
  return (
    <div>
      <div className="flex justify-between text-xs"><span className="text-ink/60">{label}</span><span className="font-semibold tabular-nums">{value}%</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/8"><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(3, value)}%` }} /></div>
    </div>
  );
}

// ---------------------------------------------------------------- Report cards

function ReportCards() {
  const toast = useToast();
  const [days, setDays] = useState(90);
  const [areas, setAreas] = useState<AreaCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api<{ areas: AreaCard[] }>(`/insights/areas?days=${days}`)
      .then((d) => active && setAreas(d.areas))
      .catch((err) => active && setError(err instanceof ApiError ? err.message : "Could not load report cards"));
    return () => {
      active = false;
    };
  }, [days]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-ink/12 bg-surface p-0.5">
          {[30, 90, 180].map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${days === d ? "bg-accent text-paper" : "text-ink/60"}`}>{d} days</button>
          ))}
        </div>
        <button type="button" onClick={() => window.print()} className="btn btn-outline !rounded-full !py-2 text-xs"><Printer size={15} aria-hidden /> Print</button>
        <button
          type="button"
          onClick={async () => (await copyText(window.location.href)) === "copied" && toast.success("Share it with your ward office or residents' association.", { title: "Link copied" })}
          className="btn btn-outline !rounded-full !py-2 text-xs"
        >
          <Share2 size={15} aria-hidden /> Share
        </button>
        <p className="ml-auto max-w-md text-[11px] text-ink/50">Grade = 35% fixed on time + 30% share fixed + 20% speed + 15% stayed fixed. Areas with at least 3 reports in the period.</p>
      </div>

      {areas === null ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-72 !rounded-3xl" />)}</div>
      ) : areas.length === 0 ? (
        <EmptyState icon={Award} title="Not enough data yet" text="Report cards appear once an area has at least 3 reports in the period." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {areas.map((a, i) => {
            const tone = GRADE_TONE[a.grade];
            const moved = a.previousGrade ? ORDER.indexOf(a.grade) - ORDER.indexOf(a.previousGrade) : 0;
            return (
              <article key={a.area} className="card card-hover reveal p-5" style={{ transitionDelay: `${Math.min(i, 6) * 60}ms` }}>
                <div className="flex items-start gap-4">
                  <div className="relative grid size-20 shrink-0 place-items-center">
                    <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden>
                      <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeOpacity=".08" strokeWidth="7" />
                      <circle cx="40" cy="40" r="35" fill="none" stroke={tone.ring} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(a.score / 100) * 220} 220`} />
                    </svg>
                    <span className={`font-display text-4xl font-bold ${tone.text}`}>{a.grade}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-xl font-semibold">{a.area}</h3>
                    <p className="text-xs text-ink/55">Score {a.score}/100 · {a.reported} reports</p>
                    {a.previousGrade && (
                      <p className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${moved > 0 ? "bg-resolved/12 text-resolved" : moved < 0 ? "bg-alert/10 text-alert" : "bg-ink/6 text-ink/60"}`}>
                        {moved > 0 ? <ArrowUpRight size={12} aria-hidden /> : moved < 0 ? <ArrowDownRight size={12} aria-hidden /> : null}
                        {moved === 0 ? `Same as before (${a.previousGrade})` : `From ${a.previousGrade}`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-5 space-y-2.5">
                  <Bar label="Fixed on time" value={a.onTimeRate} />
                  <Bar label="Share fixed" value={a.fixRate} />
                  <Bar label="Reopened after a fix" value={a.reopenRate} good={false} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-ink/5 py-2"><p className="font-display text-lg font-bold">{a.openNow}</p><p className="text-[10px] text-ink/55">open now</p></div>
                  <div className="rounded-xl bg-ink/5 py-2"><p className={`font-display text-lg font-bold ${a.overdueNow ? "text-alert" : ""}`}>{a.overdueNow}</p><p className="text-[10px] text-ink/55">overdue</p></div>
                  <div className="rounded-xl bg-ink/5 py-2"><p className={`font-display text-lg font-bold ${a.chronicSpots ? "text-alert" : ""}`}>{a.chronicSpots}</p><p className="text-[10px] text-ink/55">chronic spots</p></div>
                </div>
                <p className="mt-3 flex items-center gap-2 text-xs text-ink/60">
                  <Gauge size={14} aria-hidden /> Average fix {formatDuration(a.avgFixHours)}
                  {a.topCategory && <span className="ml-auto inline-flex items-center gap-1.5">Most reported <CategoryChip category={a.topCategory} size="sm" /></span>}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Chronic spots

function FitSpots({ spots }: { spots: { lat: number; lng: number }[] }) {
  const map = useMap();
  const n = spots.length;
  useEffect(() => {
    if (!n || map.getSize().x === 0) return;
    map.fitBounds(L.latLngBounds(spots.map((s) => [s.lat, s.lng] as [number, number])), { padding: [50, 50], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, map]);
  return null;
}

function Chronic() {
  const [spots, setSpots] = useState<ChronicSpot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    api<{ spots: ChronicSpot[] }>("/insights/chronic?days=120")
      .then((d) => setSpots(d.spots))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load chronic spots"));
  }, []);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!spots) return <Skeleton className="h-96 !rounded-3xl" />;
  if (spots.length === 0) return <EmptyState icon={Repeat} title="No chronic spots" text="No place has had the same problem three or more times in the last 120 days." />;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="card overflow-hidden p-2 lg:sticky lg:top-6 lg:self-start">
        <MapContainer center={[17.43, 78.45]} zoom={11} scrollWheelZoom={false} className="z-0 h-[28rem] w-full rounded-2xl">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitSpots spots={spots} />
          {spots.map((s) => (
            <CircleMarker
              key={s.id}
              center={[s.lat, s.lng]}
              radius={10 + s.count * 3}
              eventHandlers={{ mouseover: () => setActive(s.id), mouseout: () => setActive(null) }}
              pathOptions={{ color: "#b83a2e", weight: active === s.id ? 4 : 2, fillColor: CATEGORY_COLOR[s.category], fillOpacity: active === s.id ? 0.55 : 0.32 }}
            >
              <Tooltip>{s.label ?? categoryMeta(s.category).label} · {s.count} reports · {s.area}</Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
        <p className="px-2 pb-1 pt-2 text-[11px] text-ink/50">Same kind of problem within 60 m, three or more times in 120 days, coming back after being fixed. Bigger circle, more repeats.</p>
      </div>
      <ul className="space-y-3">
        {spots.map((s) => (
          <li key={s.id} onMouseEnter={() => setActive(s.id)} onMouseLeave={() => setActive(null)} className={`card reveal p-5 transition ${active === s.id ? "border-alert/50 shadow-lift" : ""}`}>
            <div className="flex items-start gap-3">
              <CategoryChip category={s.category} />
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-semibold">{s.label ?? categoryMeta(s.category).label} keeps coming back</h3>
                <p className="truncate text-xs text-ink/55">{s.address ?? s.area}</p>
              </div>
              <span className="rounded-full bg-alert/12 px-2.5 py-1 text-xs font-bold text-alert">{s.count}×</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/65">
              <span className="inline-flex items-center gap-1"><RotateCcw size={13} aria-hidden /> Returned {s.recurrences}× after a fix</span>
              {s.avgGapDays !== null && <span className="inline-flex items-center gap-1"><CalendarClock size={13} aria-hidden /> Every ~{s.avgGapDays} days</span>}
              <span>{s.open} open now</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {s.issues.map((i) => (
                <Link key={i.id} to={`/issues/${i.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 px-2.5 py-1 text-[11px] font-medium transition hover:border-accent">
                  <span className="size-2 rounded-full" style={{ background: STATUS_META[i.status].hex }} /> {i.ticket}
                </Link>
              ))}
            </div>
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-marker/12 px-3 py-2.5 text-sm text-ink/80">
              <Lightbulb size={16} className="mt-0.5 shrink-0 text-marker-dark" aria-hidden /> <span><span className="font-semibold">Permanent fix:</span> {s.suggestion}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- Time-lapse

function FitAll({ items }: { items: TimelineItem[] }) {
  const map = useMap();
  const n = items.length;
  useEffect(() => {
    if (!n || map.getSize().x === 0) return;
    map.fitBounds(L.latLngBounds(items.map((i) => [i.lat, i.lng] as [number, number])), { padding: [40, 40], maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, map]);
  return null;
}

const DAY = 86_400_000;

function Replay() {
  const [items, setItems] = useState<TimelineItem[] | null>(null);
  const [range, setRange] = useState({ start: 0, end: 1 });
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);

  useEffect(() => {
    api<{ items: TimelineItem[] }>("/insights/timeline?days=90").then((d) => {
      const end = Date.now();
      setItems(d.items);
      setRange({ start: d.items.length ? new Date(d.items[0].createdAt).getTime() : end - 90 * DAY, end });
    });
  }, []);

  const { start, end } = range;
  const now = start + t * (end - start);

  // One real second plays `speed` days of the city.
  useEffect(() => {
    if (!playing) return;
    let last = 0;
    let id = 0;
    const loop = (ts: number) => {
      const dt = last ? ts - last : 0;
      last = ts;
      setT((v) => {
        const next = v + (dt / 1000) * ((speed * DAY) / Math.max(DAY, end - start));
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [playing, speed, start, end]);

  if (!items) return <Skeleton className="h-[32rem] !rounded-3xl" />;

  const visible = items.filter((i) => new Date(i.createdAt).getTime() <= now);
  const fixed = visible.filter((i) => i.resolvedAt && new Date(i.resolvedAt).getTime() <= now).length;
  const closed = visible.filter((i) => i.rejectedAt && new Date(i.rejectedAt).getTime() <= now).length;
  const open = visible.length - fixed - closed;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-ink/10 shadow-card">
      <MapContainer center={[17.43, 78.45]} zoom={11} scrollWheelZoom={false} zoomControl={false} className="z-0 h-[34rem] w-full">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitAll items={items} />
        {visible.map((i) => {
          const created = new Date(i.createdAt).getTime();
          const isFixed = i.resolvedAt && new Date(i.resolvedAt).getTime() <= now;
          const isClosed = i.rejectedAt && new Date(i.rejectedAt).getTime() <= now;
          const fresh = now - created < 2 * DAY;
          return (
            <CircleMarker
              key={i.id}
              center={[i.lat, i.lng]}
              radius={isFixed || isClosed ? 4 : fresh ? 11 : 7}
              pathOptions={{
                stroke: fresh && !isFixed,
                color: "#ffffff",
                weight: 2,
                fillColor: isClosed ? "#6b7280" : isFixed ? "#2e7d5b" : CATEGORY_COLOR[i.category],
                fillOpacity: isFixed || isClosed ? 0.55 : 0.9,
              }}
            />
          );
        })}
      </MapContainer>

      <div className="glass absolute left-3 top-3 z-[600] rounded-2xl px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-ink/50">City time-lapse</p>
        <p className="font-display text-2xl font-bold tabular-nums">{new Date(now).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
        <div className="mt-2 flex gap-4 text-xs">
          <span><b className="font-display text-base tabular-nums">{visible.length}</b> reported</span>
          <span className="text-alert"><b className="font-display text-base tabular-nums">{open}</b> open</span>
          <span className="text-resolved"><b className="font-display text-base tabular-nums">{fixed}</b> fixed</span>
        </div>
      </div>

      <div className="glass absolute inset-x-3 bottom-3 z-[600] flex flex-wrap items-center gap-3 rounded-2xl px-3 py-2.5">
        <button
          type="button"
          onClick={() => {
            if (t >= 1) setT(0);
            setPlaying((p) => !p);
          }}
          aria-label={playing ? "Pause" : "Play"}
          className="grid size-11 place-items-center rounded-full bg-accent text-paper shadow-lift transition hover:scale-105"
        >
          {playing ? <Pause size={19} aria-hidden /> : <Play size={19} aria-hidden />}
        </button>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(t * 1000)}
          onChange={(e) => {
            setPlaying(false);
            setT(Number(e.target.value) / 1000);
          }}
          aria-label="Time"
          className="min-w-40 flex-1 accent-[var(--c-accent)]"
        />
        <div className="flex rounded-full bg-ink/6 p-0.5">
          {[1, 2, 5, 10].map((s) => (
            <button key={s} type="button" onClick={() => setSpeed(s)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${speed === s ? "bg-surface shadow-card" : "text-ink/55"}`}>
              {s}d/s
            </button>
          ))}
        </div>
        <div className="hidden gap-3 text-[11px] sm:flex">
          <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full ring-2 ring-white" style={{ background: CATEGORY_COLOR.pothole }} /> New</span>
          <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-resolved" /> Fixed</span>
        </div>
      </div>
    </div>
  );
}

export default function Insights() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "cards") as Tab;

  return (
    <div className="space-y-6">
      <PageHeader title="Insights" subtitle="How each area is doing, where problems keep coming back, and 90 days of the city in motion." />
      <div className="no-print -mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-ink/10 bg-surface p-1 shadow-card" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setParams({ tab: id })} className={`inline-flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === id ? "bg-accent text-paper shadow-card" : "text-ink/60 hover:bg-ink/5 hover:text-ink"}`}>
            <Icon size={16} aria-hidden /> {label}
          </button>
        ))}
      </div>
      <div key={tab} className="animate-fade">
        {tab === "cards" && <ReportCards />}
        {tab === "chronic" && <Chronic />}
        {tab === "replay" && <Replay />}
      </div>
    </div>
  );
}
