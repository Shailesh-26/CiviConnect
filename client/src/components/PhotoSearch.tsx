import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CloudOff, ImageOff, Search } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { issueLabel } from "../lib/constants";
import { timeAgo } from "../lib/format";
import type { PhotoSearchHit } from "../types";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "./ui";

const EXAMPLES = ["flooded road", "garbage near a school", "street light at night", "fallen tree on a road", "broken footpath"];
const KINDS = [
  { id: "", label: "All photos" },
  { id: "report", label: "Citizen photos" },
  { id: "proof", label: "Proof photos" },
] as const;
type Kind = (typeof KINDS)[number]["id"];
type State = { status: "idle" } | { status: "loading" } | { status: "offline" } | { status: "error"; message: string } | { status: "done"; query: string; total: number; results: PhotoSearchHit[]; looser: PhotoSearchHit[] };

// Describe a photo in plain words and the Photo Assistant finds the closest stored photos.
export function PhotoSearch() {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Kind>("");
  const [state, setState] = useState<State>({ status: "idle" });
  const [showLooser, setShowLooser] = useState(false);

  async function run(q: string, k: Kind) {
    const query = q.trim();
    if (query.length < 2) return;
    setText(query);
    setState({ status: "loading" });
    try {
      const params = new URLSearchParams({ q: query });
      if (k) params.set("kind", k);
      const data = await api<{ query: string; total: number; results: PhotoSearchHit[]; looser?: PhotoSearchHit[] }>(`/vision/search?${params}`);
      setState({ status: "done", ...data, looser: data.looser ?? [] });
      setShowLooser(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) setState({ status: "offline" });
      else setState({ status: "error", message: err instanceof ApiError ? err.message : "Search failed. Try again." });
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    run(text, kind);
  }

  const best = state.status === "done" ? (state.results[0] ?? state.looser[0])?.score ?? 1 : 1;

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="card p-5">
        <label htmlFor="photo-q" className="text-sm font-semibold">Describe what you're looking for</label>
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" aria-hidden />
            <input id="photo-q" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="e.g. water logging under a bridge" className="input !pl-10" />
          </div>
          <button type="submit" disabled={text.trim().length < 2 || state.status === "loading"} className="btn btn-primary">Search</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => run(ex, kind)} className="rounded-full border border-ink/12 px-2.5 py-1 text-xs text-ink/65 transition hover:border-accent hover:text-accent">{ex}</button>
          ))}
          <span className="ml-auto flex gap-1 rounded-full bg-ink/5 p-0.5">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={kind === k.id}
                onClick={() => {
                  setKind(k.id);
                  if (state.status === "done") run(state.query, k.id);
                }}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${kind === k.id ? "bg-surface text-accent shadow-card" : "text-ink/55 hover:text-ink"}`}
              >
                {k.label}
              </button>
            ))}
          </span>
        </div>
        <p className="mt-3 text-[11px] text-ink/45">Runs on the local Photo Assistant. No photo or text leaves this computer.</p>
      </form>

      {state.status === "idle" && <EmptyState icon={Search} title="Search every photo by words" text="Try 'flooded road' or 'garbage near a school'. Useful for finding similar past cases before a site visit." />}
      {state.status === "offline" && <EmptyState icon={CloudOff} title="The Photo Assistant is offline" text="Start the ml service, then search again." />}
      {state.status === "error" && <p className="rounded-xl bg-alert/10 px-4 py-3 text-sm text-alert">{state.message}</p>}
      {state.status === "loading" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton aspect-[4/3] w-full rounded-2xl" />)}
        </div>
      )}
      {state.status === "done" && state.total === 0 && <EmptyState icon={ImageOff} title="No photos yet" text="Photos are added as people report. On an existing database run: npm run vision:index" />}
      {state.status === "done" && state.total > 0 && state.results.length === 0 && (
        <EmptyState icon={ImageOff} title="No close matches" text={`None of the ${state.total} photos clearly shows "${state.query}". Try other words${state.looser.length ? ", or look at the loosely related ones below" : ""}.`} />
      )}
      {state.status === "done" && state.results.length > 0 && (
        <>
          <p className="text-sm text-ink/55">
            {state.results.length} {state.results.length === 1 ? "photo matches" : "photos match"} <span className="font-semibold text-ink">"{state.query}"</span> among {state.total} photos
          </p>
          <HitGrid hits={state.results} best={best} />
        </>
      )}
      {state.status === "done" && state.looser.length > 0 && (
        <div className="space-y-4">
          <button type="button" onClick={() => setShowLooser((v) => !v)} aria-expanded={showLooser} className="btn btn-outline w-full !py-2.5 text-sm">
            {showLooser ? "Hide" : "Show"} {state.looser.length} loosely related {state.looser.length === 1 ? "photo" : "photos"}
          </button>
          {showLooser && (
            <div className="opacity-80">
              <HitGrid hits={state.looser} best={best} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HitGrid({ hits, best }: { hits: PhotoSearchHit[]; best: number }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {hits.map((hit, i) => (
        <li key={hit.photoUrl} className="animate-rise" style={{ animationDelay: `${Math.min(i, 11) * 45}ms` }}>
          <Link to={`/issues/${hit.id}`} className="group block overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
            <div className="relative aspect-[4/3] overflow-hidden bg-ink/5">
              <img src={hit.photoUrl} alt={issueLabel(hit)} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
              <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${hit.kind === "proof" ? "bg-resolved" : "bg-black/55 backdrop-blur"}`}>{hit.kind === "proof" ? "Proof" : "Citizen"}</span>
            </div>
            <div className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold group-hover:text-accent">{issueLabel(hit)}</p>
                <StatusBadge status={hit.status} />
              </div>
              <p className="truncate text-xs text-ink/50">{hit.ticket} · {hit.address ?? "No address"} · {timeAgo(hit.at)}</p>
              <span className="block h-1.5 overflow-hidden rounded-full bg-ink/8" title="How close it is to your words, compared with the best match">
                <span className="cc-grow block h-full origin-left rounded-full bg-accent" style={{ "--to": Math.max(0.05, Math.min(1, hit.score / best)), animationDelay: `${Math.min(i, 11) * 45}ms` } as React.CSSProperties} />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
