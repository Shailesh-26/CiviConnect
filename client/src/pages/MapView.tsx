import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type L from "leaflet";
import {
  ArrowRight,
  Flame,
  Layers,
  Layers2,
  List,
  LocateFixed,
  Maximize,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Share2,
  ThumbsUp,
  X,
} from "lucide-react";
import { CategoryChip } from "../components/CategoryChip";
import { ExploreMap, type Bounds } from "../components/ExploreMap";
import { pinColor } from "../lib/mapColors";
import { SlaChip } from "../components/SlaChip";
import { StatusBadge } from "../components/StatusBadge";
import { ErrorNote, Skeleton } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { CATEGORIES, CATEGORY_COLOR, issueLabel, OPEN, PRIORITY_META } from "../lib/constants";
import { timeAgo } from "../lib/format";
import { useIssueActions } from "../lib/useIssueActions";
import { useMediaQuery } from "../lib/useMediaQuery";
import { useToast } from "../lib/toast-context";
import type { Category, Issue } from "../types";

type Show = "open" | "fixed" | "all";

const LEGEND = [
  { label: "High", color: PRIORITY_META.high.hex },
  { label: "Medium", color: PRIORITY_META.medium.hex },
  { label: "Low", color: PRIORITY_META.low.hex },
  { label: "Fixed", color: "#2e7d5b" },
];

const glass = "border border-white/40 bg-surface/80 shadow-lift backdrop-blur-xl dark:border-white/10";

// Explore every issue on a full map: filter, search this area, cluster or heat, and preview.
export default function MapView() {
  const toast = useToast();
  const actions = useIssueActions();
  const wide = useMediaQuery("(min-width: 1024px)");
  const [mapObj, setMapObj] = useState<L.Map | null>(null);

  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [show, setShow] = useState<Show>("open");
  const [cats, setCats] = useState<Category[]>([]);
  const [lateOnly, setLateOnly] = useState(false);
  const [clustered, setClustered] = useState(true);
  const [heat, setHeat] = useState(false);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [followMap, setFollowMap] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [fly, setFly] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let active = true;
    api<{ issues: Issue[] }>("/issues")
      .then((data) => active && setIssues(data.issues))
      .catch((err) => active && setError(err instanceof ApiError ? err.message : "Could not load the map"));
    return () => {
      active = false;
    };
  }, []);

  // Filters shape both the pins and the list.
  const filtered = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (issues ?? []).filter((i) => {
      if (show === "open" && !OPEN.includes(i.status)) return false;
      if (show === "fixed" && i.status !== "resolved") return false;
      if (cats.length && !cats.includes(i.category)) return false;
      if (lateOnly && i.sla?.state !== "breached") return false;
      if (!words.length) return true;
      const text = `${i.ticket} ${issueLabel(i)} ${i.address ?? ""} ${i.description}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [issues, q, show, cats, lateOnly]);

  // The list shows what is inside the visible map area ("search as I move the map").
  const inView = useMemo(() => {
    if (!followMap || !bounds) return filtered;
    return filtered.filter((i) => i.location.lat <= bounds.north && i.location.lat >= bounds.south && i.location.lng <= bounds.east && i.location.lng >= bounds.west);
  }, [filtered, bounds, followMap]);

  const sorted = useMemo(() => [...inView].sort((a, b) => b.priority - a.priority), [inView]);
  const selected = (issues ?? []).find((i) => i.id === selectedId) ?? null;
  const late = filtered.filter((i) => i.sla?.state === "breached").length;

  const focus = useCallback((i: Issue) => {
    setSelectedId(i.id);
    setFly({ lat: i.location.lat, lng: i.location.lng, zoom: 16 });
    setSheetOpen(false);
  }, []);

  function locate() {
    if (!navigator.geolocation) return toast.error("Your browser does not support location.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setFly({ lat: pos.coords.latitude, lng: pos.coords.longitude, zoom: 15 }),
      () => toast.error("Allow location access to jump to where you are.", { title: "Location blocked" }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function zoomIn() {
    mapObj?.zoomIn();
  }
  function zoomOut() {
    mapObj?.zoomOut();
  }

  function fitAll() {
    if (!mapObj || !filtered.length) return;
    const lats = filtered.map((i) => i.location.lat);
    const lngs = filtered.map((i) => i.location.lng);
    mapObj.flyToBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      { paddingTopLeft: [wide && panelOpen ? 400 : 60, 60], paddingBottomRight: [60, 60], duration: 0.7 },
    );
  }

  const toggleCat = (c: Category) => setCats((all) => (all.includes(c) ? all.filter((x) => x !== c) : [...all, c]));

  const filters = (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ticket, place, problem" aria-label="Search the map" className="input !rounded-xl !py-2 !pl-9 text-sm" />
      </div>
      <div className="flex rounded-xl bg-ink/6 p-0.5" role="radiogroup" aria-label="Show">
        {(["open", "fixed", "all"] as const).map((s) => (
          <button key={s} type="button" role="radio" aria-checked={show === s} onClick={() => setShow(s)} className={`flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize transition ${show === s ? "bg-surface text-ink shadow-card" : "text-ink/55 hover:text-ink"}`}>
            {s}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(({ value, label, icon: Icon }) => {
          const on = cats.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggleCat(value)}
              aria-pressed={on}
              style={on ? { background: CATEGORY_COLOR[value], borderColor: CATEGORY_COLOR[value] } : undefined}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${on ? "text-white" : "border-ink/12 bg-surface/70 text-ink/70 hover:border-ink/30"}`}
            >
              <Icon size={12} aria-hidden style={on ? undefined : { color: CATEGORY_COLOR[value] }} /> {label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setLateOnly((v) => !v)} aria-pressed={lateOnly} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${lateOnly ? "bg-alert text-white" : "bg-alert/10 text-alert hover:bg-alert/15"}`}>
          <Flame size={12} aria-hidden /> Overdue only{late ? ` · ${late}` : ""}
        </button>
        <button type="button" onClick={() => setClustered((v) => !v)} aria-pressed={clustered} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${clustered ? "bg-accent text-paper" : "bg-ink/6 text-ink/65"}`}>
          <Layers2 size={12} aria-hidden /> Group pins
        </button>
        <button type="button" onClick={() => setHeat((v) => !v)} aria-pressed={heat} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${heat ? "bg-accent text-paper" : "bg-ink/6 text-ink/65"}`}>
          <Layers size={12} aria-hidden /> Heat
        </button>
      </div>
    </div>
  );

  const list = (
    <>
      <div className="flex items-center justify-between px-1 pb-2 text-xs">
        <span className="font-semibold">{sorted.length} {followMap ? "in this area" : "issues"}</span>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-ink/60">
          <input type="checkbox" checked={followMap} onChange={(e) => setFollowMap(e.target.checked)} className="accent-[var(--c-accent)]" /> Search as I move
        </label>
      </div>
      <ul className="cc-scroll -mx-1 flex-1 space-y-1 overflow-y-auto px-1">
        {sorted.length === 0 ? (
          <li className="px-2 py-8 text-center text-xs text-ink/50">Nothing here. Zoom out, move the map or clear a filter.</li>
        ) : (
          sorted.slice(0, 80).map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => focus(i)}
                onMouseEnter={() => setHoveredId(i.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition ${selectedId === i.id ? "bg-accent/12" : "hover:bg-ink/6"}`}
              >
                <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: pinColor(i) }} aria-hidden />
                <CategoryChip category={i.category} icon={i.customIcon} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{issueLabel(i)}</span>
                  <span className="block truncate text-[11px] text-ink/50">{i.ticket} · {i.address ?? timeAgo(i.createdAt)}</span>
                </span>
                {i.sla && OPEN.includes(i.status) && <SlaChip sla={i.sla} compact />}
              </button>
            </li>
          ))
        )}
      </ul>
    </>
  );

  if (error) return <ErrorNote>{error}</ErrorNote>;

  return (
    <div className="relative -mt-2 h-[calc(100dvh-12.5rem)] min-h-[30rem] overflow-hidden rounded-3xl border border-ink/10 shadow-card lg:-mt-4 lg:h-[calc(100dvh-5.5rem)]">
      {issues === null ? (
        <Skeleton className="size-full !rounded-3xl" />
      ) : (
        <ExploreMap
          mapRef={setMapObj}
          issues={filtered}
          clustered={clustered}
          heat={heat}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={(id) => {
            setSelectedId(id);
            setSheetOpen(false);
          }}
          onBounds={setBounds}
          fly={fly}
          padLeft={wide && panelOpen ? 340 : 0}
        />
      )}

      {/* Side panel (desktop) */}
      {wide && (
        <div className={`absolute bottom-3 left-3 top-3 z-[600] flex w-80 flex-col rounded-3xl p-3 transition-transform duration-300 ${glass} ${panelOpen ? "" : "-translate-x-[calc(100%+1rem)]"}`}>
          <div className="flex items-center justify-between px-1 pb-3">
            <div>
              <h1 className="font-display text-lg font-semibold leading-tight">Explore the city</h1>
              <p className="text-[11px] text-ink/55">{filtered.length} issues match · {late} overdue</p>
            </div>
            <button type="button" onClick={() => setPanelOpen(false)} aria-label="Hide panel" className="grid size-8 place-items-center rounded-lg text-ink/55 hover:bg-ink/6"><PanelLeftClose size={17} aria-hidden /></button>
          </div>
          {filters}
          <div className="my-3 h-px bg-ink/10" />
          {list}
        </div>
      )}
      {wide && !panelOpen && (
        <button type="button" onClick={() => setPanelOpen(true)} className={`absolute left-3 top-3 z-[600] inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ${glass}`}>
          <PanelLeftOpen size={17} aria-hidden /> Filters & list
        </button>
      )}

      {/* Phone: filters on top, list as a bottom sheet */}
      {!wide && (
        <>
          <div className={`absolute inset-x-3 top-3 z-[600] rounded-2xl p-2.5 ${glass}`}>
            <details>
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
                <Search size={16} aria-hidden /> Filters <span className="ml-auto text-xs font-normal text-ink/55">{filtered.length} issues</span>
              </summary>
              <div className="pt-3">{filters}</div>
            </details>
          </div>
          <button type="button" onClick={() => setSheetOpen(true)} className={`absolute bottom-3 left-1/2 z-[600] inline-flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${glass}`}>
            <List size={16} aria-hidden /> List · {sorted.length}
          </button>
          {sheetOpen && (
            <div className={`absolute inset-x-0 bottom-0 z-[700] flex max-h-[70%] flex-col rounded-t-3xl p-3 animate-rise ${glass}`}>
              <div className="flex items-center justify-between pb-2">
                <span className="mx-auto h-1.5 w-10 rounded-full bg-ink/20" />
                <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close list" className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-ink/55 hover:bg-ink/6"><X size={17} aria-hidden /></button>
              </div>
              {list}
            </div>
          )}
        </>
      )}

      {/* Map controls and legend */}
      <div className={`absolute right-3 z-[600] flex flex-col overflow-hidden rounded-2xl ${glass} ${wide ? "top-3" : "top-20"}`}>
        {[
          { label: "Zoom in", icon: Plus, onClick: zoomIn },
          { label: "Zoom out", icon: Minus, onClick: zoomOut },
          { label: "Show everything", icon: Maximize, onClick: fitAll },
          { label: "Where am I", icon: LocateFixed, onClick: locate },
        ].map(({ label, icon: Icon, onClick }) => (
          <button key={label} type="button" onClick={onClick} aria-label={label} title={label} className="grid size-10 place-items-center border-b border-ink/8 text-ink/70 transition last:border-0 hover:bg-ink/6 hover:text-ink">
            <Icon size={17} aria-hidden />
          </button>
        ))}
      </div>
      {wide && (
        <div className={`absolute bottom-7 right-3 z-[600] flex gap-3 rounded-2xl px-3 py-2 text-[11px] font-medium ${glass}`}>
          {LEGEND.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: l.color }} /> {l.label}</span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className="grid size-4 place-items-center rounded-full bg-signboard text-[8px] font-bold text-white">9</span> Group</span>
        </div>
      )}

      {/* Preview of the selected issue */}
      {selected && (
        <div className={`absolute z-[650] w-[min(26rem,calc(100%-1.5rem))] rounded-3xl p-4 animate-rise ${glass} ${wide ? "bottom-14 left-1/2 -translate-x-1/2" : "bottom-16 left-3"}`}>
          <button type="button" onClick={() => setSelectedId(null)} aria-label="Close preview" className="absolute right-3 top-3 grid size-7 place-items-center rounded-lg text-ink/55 hover:bg-ink/6"><X size={15} aria-hidden /></button>
          <div className="flex gap-3 pr-6">
            {selected.images[0] ? (
              <img src={selected.images[0].url} alt="" className="size-20 shrink-0 rounded-2xl object-cover" />
            ) : (
              <CategoryChip category={selected.category} icon={selected.customIcon} size="lg" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-semibold">{issueLabel(selected)}</p>
              <p className="truncate text-xs text-ink/55">{selected.ticket} · {selected.address ?? "No landmark"}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={selected.status} />
                {selected.sla && OPEN.includes(selected.status) && <SlaChip sla={selected.sla} compact />}
              </div>
            </div>
          </div>
          <p className="mt-3 line-clamp-2 text-sm text-ink/70">{selected.description}</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-ink/55"><ThumbsUp size={13} aria-hidden /> {selected.supporterCount} · {selected.reportCount} reports</span>
            <button type="button" onClick={() => actions.share(selected)} className="btn btn-ghost ml-auto !px-3 !py-1.5 text-xs"><Share2 size={14} aria-hidden /> Share</button>
            <Link to={`/issues/${selected.id}`} className="btn btn-primary !px-3 !py-1.5 text-xs">Open <ArrowRight size={14} aria-hidden /></Link>
          </div>
        </div>
      )}
    </div>
  );
}
