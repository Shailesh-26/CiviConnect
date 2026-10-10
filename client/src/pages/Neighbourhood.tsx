import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowBigUp,
  BadgeCheck,
  CircleDot,
  Flame,
  House,
  Inbox,
  LocateFixed,
  Map as MapIcon,
  MapPinHouse,
  RefreshCw,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { FeedCard } from "../components/FeedCard";
import { FeedMap } from "../components/FeedMap";
import { FlagDialog } from "../components/FlagDialog";
import { EmptyState, ErrorNote, Skeleton } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { CATEGORIES, CATEGORY_COLOR, OPEN } from "../lib/constants";
import { useIssueActions } from "../lib/useIssueActions";
import { useMediaQuery } from "../lib/useMediaQuery";
import { useToast } from "../lib/toast-context";
import type { Category, FeedItem, FeedResponse, FeedSort } from "../types";

const SORTS: { value: FeedSort; label: string; icon: LucideIcon }[] = [
  { value: "hot", label: "Hot", icon: Flame },
  { value: "new", label: "New", icon: Sparkles },
  { value: "top", label: "Top", icon: TrendingUp },
  { value: "unresolved", label: "Unresolved", icon: CircleDot },
  { value: "resolved", label: "Fixed", icon: BadgeCheck },
];
const RADII = [1, 2, 5, 10];

type LatLng = { lat: number; lng: number };

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="card flex gap-4 p-4">
          <Skeleton className="h-24 w-12" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl bg-ink/5 p-3.5">
      <p className={`font-display text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs text-ink/60">{label}</p>
    </div>
  );
}

export default function Neighbourhood() {
  const { user } = useAuth();
  const toast = useToast();
  const actions = useIssueActions();

  const [sort, setSort] = useState<FeedSort>("hot");
  const [radiusKm, setRadiusKm] = useState(user?.radiusKm ?? 2);
  const [category, setCategory] = useState<Category | "">("");
  const [here, setHere] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);

  const [items, setItems] = useState<FeedItem[]>([]);
  const [meta, setMeta] = useState<Omit<FeedResponse, "items"> | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<{ message: string; noLocation: boolean } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [flagging, setFlagging] = useState<FeedItem | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery("(min-width: 1024px)");

  const query = useCallback(
    (page: number) => {
      const params = new URLSearchParams({ sort, radiusKm: String(radiusKm), page: String(page) });
      if (category) params.set("category", category);
      if (here) {
        params.set("lat", String(here.lat));
        params.set("lng", String(here.lng));
      }
      return api<FeedResponse>(`/feed?${params}`);
    },
    [sort, radiusKm, category, here],
  );

  // First page whenever a filter changes. "loading" is simply: the shown data is for older filters.
  const requestKey = JSON.stringify([sort, radiusKm, category, here, refreshKey]);
  const loading = loadedKey !== requestKey;
  useEffect(() => {
    let active = true;
    query(1)
      .then((data) => {
        if (!active) return;
        const { items: first, ...rest } = data;
        setItems(first);
        setMeta(rest);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        const noLocation = err instanceof ApiError && err.data.code === "NO_LOCATION";
        setError({ message: err instanceof ApiError ? err.message : "Could not load your neighbourhood", noLocation });
      })
      .finally(() => active && setLoadedKey(requestKey));
    return () => {
      active = false;
    };
  }, [query, requestKey]);

  const loadMore = useCallback(async () => {
    if (!meta?.hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await query(meta.page + 1);
      const { items: more, ...rest } = data;
      setItems((prev) => [...prev, ...more.filter((m) => !prev.some((p) => p.id === m.id))]);
      setMeta(rest);
    } catch (err) {
      actions.fail(err);
    } finally {
      setLoadingMore(false);
    }
  }, [meta, loadingMore, query, actions]);

  // Load the next page automatically when the end of the list scrolls into view.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !meta?.hasMore) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: "400px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [meta, loadMore]);

  const replace = useCallback((next: FeedItem) => setItems((all) => all.map((i) => (i.id === next.id ? next : i))), []);

  async function hide(item: FeedItem) {
    const index = items.findIndex((i) => i.id === item.id);
    setItems((all) => all.filter((i) => i.id !== item.id));
    try {
      await actions.hide(item);
      toast.info("You will not see this issue in your feed any more.", {
        title: "Hidden",
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await actions.hide(item);
              setItems((all) => [...all.slice(0, index), item, ...all.slice(index)]);
            } catch (err) {
              actions.fail(err);
            }
          },
        },
      });
    } catch (err) {
      setItems((all) => [...all.slice(0, index), item, ...all.slice(index)]);
      actions.fail(err);
    }
  }

  function useMyLocation() {
    if (here) {
      setHere(null);
      return;
    }
    if (!navigator.geolocation) {
      toast.error("Your browser does not support location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        toast.error("Allow location access in your browser, or set a home spot in your profile.", { title: "Location blocked" });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const pulse = useMemo(
    () => ({
      open: items.filter((i) => OPEN.includes(i.status)).length,
      fixed: items.filter((i) => i.status === "resolved").length,
      mine: items.filter((i) => i.supportedByMe).length,
    }),
    [items],
  );

  const wider = RADII[RADII.indexOf(radiusKm) + 1];
  const place = here ? "your current location" : user?.homeArea || "your home";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4 animate-rise">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Neighbourhood</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight sm:text-4xl">What is happening around {place}</h1>
          <p className="mt-1.5 text-sm text-ink/60">
            {meta ? `${meta.total} ${meta.total === 1 ? "issue" : "issues"} within ${meta.radiusKm} km. ` : ""}
            Upvote what affects you: it raises the priority for the city.
          </p>
        </div>
        <Link to="/report" className="btn btn-marker !px-5 !py-3">Report something here</Link>
      </div>

      <div className="-mx-4 space-y-3 border-y border-ink/8 bg-paper/85 px-4 py-3 backdrop-blur-xl sm:-mx-8 sm:px-8 lg:sticky lg:top-0 lg:z-[1400]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Sort">
            {SORTS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={sort === value}
                onClick={() => setSort(value)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${sort === value ? "bg-ink text-paper shadow-card" : "text-ink/65 hover:bg-ink/6 hover:text-ink"}`}
              >
                <Icon size={15} aria-hidden /> {label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-full border border-ink/12 bg-surface p-0.5" role="radiogroup" aria-label="Radius">
              {RADII.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={radiusKm === r}
                  onClick={() => setRadiusKm(r)}
                  className={`rounded-full px-2.5 py-1.5 text-xs font-semibold tabular-nums transition ${radiusKm === r ? "bg-accent text-paper" : "text-ink/60 hover:text-ink"}`}
                >
                  {r} km
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              aria-pressed={Boolean(here)}
              title={here ? "Back to my home spot" : "Use where I am right now"}
              className={`btn !rounded-full !px-3 !py-2 text-xs ${here ? "btn-primary" : "btn-outline"}`}
            >
              {here ? <House size={15} aria-hidden /> : <LocateFixed size={15} aria-hidden />}
              <span className="hidden sm:inline">{locating ? "Finding you…" : here ? "Home" : "Near me"}</span>
            </button>
          </div>
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          <button
            type="button"
            onClick={() => setCategory("")}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${category === "" ? "border-ink bg-ink text-paper" : "border-ink/15 bg-surface text-ink/70 hover:border-ink/35"}`}
          >
            Everything
          </button>
          {CATEGORIES.map(({ value, label, icon: Icon }) => {
            const active = category === value;
            const color = CATEGORY_COLOR[value];
            return (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(active ? "" : value)}
                aria-pressed={active}
                style={active ? { background: color, borderColor: color } : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${active ? "text-white" : "border-ink/15 bg-surface text-ink/70 hover:border-ink/35"}`}
              >
                <Icon size={13} aria-hidden style={active ? undefined : { color }} /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {error?.noLocation ? (
        <EmptyState
          icon={MapPinHouse}
          title="Where is your neighbourhood?"
          text="Set a home spot in your profile, or use your current location, to see problems reported around you."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={useMyLocation} className="btn btn-primary"><LocateFixed size={16} aria-hidden /> Use my location</button>
              <Link to="/profile#home" className="btn btn-outline"><MapPinHouse size={16} aria-hidden /> Set home spot</Link>
            </div>
          }
        />
      ) : error ? (
        <ErrorNote>{error.message}</ErrorNote>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-4">
            {meta && (
              <button type="button" onClick={() => setMapOpen((o) => !o)} className="btn btn-outline w-full lg:hidden">
                <MapIcon size={16} aria-hidden /> {mapOpen ? "Hide map" : "Show on map"}
              </button>
            )}
            {mapOpen && meta && (
              <div className="card overflow-hidden p-2 lg:hidden">
                <FeedMap items={items} center={meta.center} radiusKm={meta.radiusKm} activeId={activeId} className="h-72" />
              </div>
            )}

            {loading ? (
              <FeedSkeleton />
            ) : items.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="All quiet around here"
                text={category || sort === "resolved" || sort === "unresolved" ? "Nothing matches these filters. Try a bigger radius or another tab." : "No problems reported within this radius. Try a bigger radius, or be the first to report one."}
                action={
                  wider ? (
                    <button type="button" onClick={() => setRadiusKm(wider)} className="btn btn-outline">Widen to {wider} km</button>
                  ) : (
                    <Link to="/report" className="btn btn-primary">Report a problem</Link>
                  )
                }
              />
            ) : (
              <>
                {items.map((item, index) => (
                  <FeedCard
                    key={item.id}
                    item={item}
                    index={index}
                    active={activeId === item.id}
                    onHover={setActiveId}
                    onChange={replace}
                    onHide={hide}
                    onFlag={setFlagging}
                  />
                ))}
                <div ref={sentinel} />
                {meta?.hasMore ? (
                  <button type="button" onClick={loadMore} disabled={loadingMore} className="btn btn-outline w-full">
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                ) : (
                  <p className="py-4 text-center text-xs text-ink/45">You are all caught up within {meta?.radiusKm} km.</p>
                )}
              </>
            )}
          </div>

          {wide && (
          <aside>
            <div className="sticky top-36 space-y-4">
              <div className="card overflow-hidden p-2">
                {meta ? <FeedMap items={items} center={meta.center} radiusKm={meta.radiusKm} activeId={activeId} className="h-[21rem]" /> : <Skeleton className="h-[21rem] w-full !rounded-2xl" />}
              </div>
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold">Pulse of this area</h2>
                  <button type="button" onClick={() => setRefreshKey((k) => k + 1)} aria-label="Refresh" className="grid size-8 place-items-center rounded-lg text-ink/50 hover:bg-ink/5 hover:text-ink">
                    <RefreshCw size={15} aria-hidden />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Tile label="Open" value={pulse.open} tone="text-alert" />
                  <Tile label="Fixed" value={pulse.fixed} tone="text-resolved" />
                  <Tile label="You upvoted" value={pulse.mine} tone="text-marker-dark" />
                </div>
                <p className="mt-3 flex items-start gap-2 text-xs text-ink/55">
                  <ArrowBigUp size={16} className="shrink-0 text-marker-dark" aria-hidden />
                  Each upvote adds to the issue's priority score, so the most felt problems reach officers first.
                </p>
              </div>
            </div>
          </aside>
          )}
        </div>
      )}

      <FlagDialog
        open={Boolean(flagging)}
        endpoint={flagging ? `/issues/${flagging.id}/flag` : ""}
        what="issue"
        onClose={() => setFlagging(null)}
        onDone={() => {
          if (flagging) replace({ ...flagging, flaggedByMe: true });
          setFlagging(null);
        }}
      />
    </div>
  );
}
