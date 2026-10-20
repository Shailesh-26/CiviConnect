import { Check, CloudOff, Moon, ScanSearch, ShieldCheck, Sparkles, TriangleAlert, Waves } from "lucide-react";
import { CATEGORY_COLOR, issueLabel } from "../lib/constants";
import type { Category, VisionResult } from "../types";
import { CategoryChip } from "./CategoryChip";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const nameOf = (c: Category) => (c === "other" ? "Other problem" : issueLabel({ category: c }));

// Overlay for the first photo: a scan line while the model looks, corner brackets once it has an answer.
export function PhotoScan({ loading, result }: { loading: boolean; result: VisionResult | null }) {
  if (loading) {
    return (
      <div className="cc-scan pointer-events-none absolute inset-0" aria-hidden>
        <span className="absolute inset-x-0 bottom-2 mx-auto w-max rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">Scanning…</span>
      </div>
    );
  }
  if (result?.verdict === "not_civic") {
    return (
      <span className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto flex w-max items-center gap-1 rounded-full bg-marker px-2.5 py-1 text-[11px] font-semibold text-[#241a00] shadow-card animate-pop">
        <TriangleAlert size={12} aria-hidden /> Not a civic problem?
      </span>
    );
  }
  if (!result || result.verdict !== "confident") return null;
  const top = result.top[0];
  const color = CATEGORY_COLOR[top.category];
  return (
    <div className="cc-lock pointer-events-none absolute inset-2" style={{ "--lock": color } as React.CSSProperties} aria-hidden>
      <i /><i /><i /><i />
      <span className="absolute inset-x-0 bottom-1 mx-auto w-max rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-card animate-pop" style={{ background: color }}>
        {nameOf(top.category)} · {pct(top.score)}
      </span>
    </div>
  );
}

type Props = {
  loading: boolean;
  offline: boolean;
  result: VisionResult | null;
  selected: Category | "";
  onPick: (c: Category) => void;
  notCivicPhotos?: number[];
  photoCount?: number;
};

export function PhotoAssistantCard({ loading, offline, result, selected, onPick, notCivicPhotos = [], photoCount = 1 }: Props) {
  if (offline) {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-2xl bg-ink/[0.04] px-4 py-3 text-sm text-ink/55 animate-fade">
        <CloudOff size={16} aria-hidden /> The Photo Assistant is offline, so pick the problem yourself in the next step.
      </p>
    );
  }
  if (!loading && !result) return null;

  return (
    <section className="spot mt-4 overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/[0.06] to-transparent p-4 animate-rise" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-7 place-items-center rounded-lg bg-accent/15 text-accent"><Sparkles size={15} aria-hidden /></span>
          Photo Assistant
        </p>
        {result && (
          <span className="rounded-full bg-ink/6 px-2 py-0.5 text-[11px] text-ink/55" title={result.model.name}>
            {result.model.mode === "trained" ? "Trained on local photos" : "Zero-shot"} · {result.ms} ms
          </span>
        )}
      </div>

      {loading && (
        <div className="mt-3 space-y-2">
          <p className="flex items-center gap-2 text-sm text-ink/60"><ScanSearch size={16} className="animate-pulse" aria-hidden /> Looking at your photo…</p>
          <div className="skeleton h-3 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      )}

      {result?.verdict === "not_civic" && (
        <div className="mt-3 flex gap-3 rounded-xl bg-marker/15 p-3 text-sm">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-marker-dark" aria-hidden />
          <div>
            <p className="font-semibold">{photoCount > 1 ? "These photos don't look like a civic problem" : "This doesn't look like a civic problem"}</p>
            <p className="mt-0.5 text-ink/65">Check you chose the right photo. You can still continue if it is.</p>
          </div>
        </div>
      )}

      {result && result.verdict !== "not_civic" && (
        <>
          {result.verdict === "confident" ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <CategoryChip category={result.top[0].category} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-semibold leading-tight">Looks like {result.top[0].category === "other" ? "another kind of problem" : `a ${nameOf(result.top[0].category).toLowerCase()}`}</p>
                <p className="text-xs text-ink/55">{pct(result.top[0].score)} sure</p>
              </div>
              {selected === result.top[0].category ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-resolved/15 px-3 py-1.5 text-xs font-semibold text-resolved animate-pop"><Check size={14} aria-hidden /> Selected</span>
              ) : (
                <button type="button" onClick={() => onPick(result.top[0].category)} className="btn btn-primary !px-3 !py-2 text-xs">Use this</button>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink/70">Not sure. It could be one of these, tap the right one:</p>
          )}

          <ul className="mt-3 space-y-1.5">
            {result.top.map((t, i) => {
              const on = selected === t.category;
              return (
                <li key={t.category}>
                  <button type="button" onClick={() => onPick(t.category)} className={`group flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left text-xs transition ${on ? "bg-accent/10" : "hover:bg-ink/5"}`}>
                    <span className={`w-24 shrink-0 truncate ${on ? "font-semibold text-accent" : "text-ink/70"}`}>{nameOf(t.category)}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/8">
                      <span className="cc-grow block h-full origin-left rounded-full" style={{ background: CATEGORY_COLOR[t.category], "--to": Math.max(0.02, t.score), animationDelay: `${i * 90}ms` } as React.CSSProperties} />
                    </span>
                    <span className="w-9 text-right tabular-nums text-ink/55">{pct(t.score)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {result && result.verdict !== "not_civic" && notCivicPhotos.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-marker/15 px-3 py-2 text-xs text-ink/75">
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-marker-dark" aria-hidden />
          <span>
            <span className="font-semibold">Photo {notCivicPhotos.join(" and ")} {notCivicPhotos.length === 1 ? "doesn't" : "don't"} look like a civic problem.</span> Remove {notCivicPhotos.length === 1 ? "it" : "them"} if {notCivicPhotos.length === 1 ? "it was" : "they were"} added by mistake.
          </span>
        </p>
      )}

      {result && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink/50">
          <ShieldCheck size={12} aria-hidden /> Faces in your photos are blurred automatically before saving.
        </p>
      )}

      {result && (result.quality.blurry || result.quality.dark) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {result.quality.blurry && <span className="inline-flex items-center gap-1.5 rounded-full bg-marker/15 px-2.5 py-1 text-xs font-medium text-marker-dark"><Waves size={13} aria-hidden /> Looks blurry: a sharper photo helps the officer</span>}
          {result.quality.dark && <span className="inline-flex items-center gap-1.5 rounded-full bg-marker/15 px-2.5 py-1 text-xs font-medium text-marker-dark"><Moon size={13} aria-hidden /> Quite dark: try with more light</span>}
        </div>
      )}
    </section>
  );
}
