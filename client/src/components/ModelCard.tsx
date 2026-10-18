import { useCallback, useEffect, useState } from "react";
import { BrainCircuit, CheckCircle2, Cpu, FlaskConical, RefreshCw, ScanSearch, TriangleAlert } from "lucide-react";
import { api } from "../lib/api";
import { CATEGORY_COLOR, issueLabel } from "../lib/constants";
import type { Category, VisionStats, VisionStatus } from "../types";
import { CountUp } from "./CountUp";
import { FixReview } from "./FixReview";
import { Ring } from "./Ring";
import { Skeleton } from "./ui";

const CLASS_NAME = (c: string) => (c === "not_civic" ? "Not civic" : c === "other" ? "Other" : issueLabel({ category: c as Category }));
const pct1 = (n: number) => Math.round(n * 1000) / 10;

function Tile({ label, value, suffix = "", hint, tone = "text-ink" }: { label: string; value: number; suffix?: string; hint?: string; tone?: string }) {
  return (
    <div className="card card-hover tilt p-4">
      <p className={`font-display text-3xl font-bold ${tone}`}><CountUp value={value} suffix={suffix} /></p>
      <p className="mt-1 text-xs text-ink/60">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-ink/45">{hint}</p>}
    </div>
  );
}

// Admin view of the Photo Assistant: is it running, how good is it on test photos, and how often
// citizens agreed with it in real use.
export function ModelCard() {
  const [status, setStatus] = useState<VisionStatus | null>(null);
  const [stats, setStats] = useState<VisionStats | null>(null);
  const [checking, setChecking] = useState(false);

  const fetchAll = useCallback(() => {
    Promise.all([
      api<VisionStatus>("/vision/status").catch(() => ({ available: false }) as VisionStatus),
      api<VisionStats>("/vision/stats").catch(() => null),
    ]).then(([s, st]) => {
      setStatus(s);
      setStats(st);
      setChecking(false);
    });
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  const load = () => {
    setChecking(true);
    fetchAll();
  };

  if (!status) return <Skeleton className="h-64 w-full !rounded-3xl" />;
  const metrics = status.available ? status.model.metrics : null;

  return (
    <div className="space-y-5">
      {/* Status */}
      <div className="relative overflow-hidden rounded-3xl bg-signboard p-6 text-white">
        <div className="grid-paper pointer-events-none absolute inset-0 opacity-20" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-5">
          <span className="grid size-14 place-items-center rounded-2xl bg-white/12"><BrainCircuit size={28} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/60">
              <span className="relative flex size-2">
                {status.available && <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-resolved" />}
                <span className={`relative inline-flex size-2 rounded-full ${status.available ? "bg-resolved" : "bg-alert"}`} />
              </span>
              Photo Assistant · {status.available ? "online" : "offline"}
            </p>
            <h2 className="mt-1 text-2xl font-semibold">{status.available ? status.model.name : "Not running"}</h2>
            <p className="mt-1 text-sm text-white/70">
              {status.available
                ? status.model.mode === "trained"
                  ? "Trained mode: a classifier fitted on your own labelled photos, on top of CLIP."
                  : "Zero-shot mode: compares each photo with written descriptions of every category. No training data used yet."
                : "Citizens can still report normally; they just won't get category suggestions."}
            </p>
          </div>
          <button type="button" onClick={load} disabled={checking} className="btn bg-white/12 text-white hover:bg-white/20">
            <RefreshCw size={16} className={checking ? "animate-spin" : ""} aria-hidden /> Re-check
          </button>
        </div>
      </div>

      {!status.available && (
        <div className="card p-5">
          <p className="flex items-center gap-2 font-semibold"><Cpu size={18} className="text-accent" aria-hidden /> Start it on this computer</p>
          <pre className="cc-scroll mt-3 overflow-x-auto rounded-xl bg-ink/[0.05] p-4 text-xs leading-relaxed">{`cd ml
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned; .venv\\Scripts\\Activate.ps1
uvicorn app.main:app --port 8000`}</pre>
          <p className="mt-2 text-xs text-ink/55">First-time setup is in the project README, under "Photo Assistant".</p>
        </div>
      )}

      {/* Test-set quality */}
      {metrics ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h3 className="text-lg font-semibold">Accuracy on held-out test photos</h3>
              <p className="text-sm text-ink/55">{metrics.nTest} photos the model never saw during training · trained {new Date(metrics.trainedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Test accuracy" value={pct1(metrics.accuracy)} suffix="%" tone="text-resolved" />
            <Tile label="Macro F1 (all classes equal)" value={Math.round(metrics.macroF1 * 100)} suffix="/100" />
            <Tile label="Zero-shot accuracy, same photos" value={pct1(metrics.zeroShotAccuracy)} suffix="%" tone="text-ink/55" hint={`+${pct1(metrics.accuracy - metrics.zeroShotAccuracy)} points after training`} />
            <Tile label="Labelled photos" value={metrics.nPhotos} hint={`${metrics.nTrain} train · ${metrics.nTest} test`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <p className="font-semibold">Per category</p>
              <ul className="mt-3 space-y-2.5">
                {metrics.classes.map((c, i) => {
                  const m = metrics.perClass[c];
                  return (
                    <li key={c} className="text-sm">
                      <div className="flex justify-between text-xs"><span className="text-ink/70">{CLASS_NAME(c)}</span><span className="tabular-nums text-ink/55">F1 {m.f1.toFixed(2)} · P {m.precision.toFixed(2)} · R {m.recall.toFixed(2)} · n {m.support}</span></div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/8">
                        <div className="cc-grow h-full origin-left rounded-full" style={{ background: c in CATEGORY_COLOR ? CATEGORY_COLOR[c as Category] : "#8b95a7", "--to": m.f1, animationDelay: `${i * 70}ms` } as React.CSSProperties} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="card p-5">
              <p className="font-semibold">Confusion matrix</p>
              <p className="text-xs text-ink/55">Rows: true category. Columns: what the model said. The diagonal is correct.</p>
              <div className="cc-scroll mt-3 overflow-x-auto">
                <table className="text-[11px]">
                  <thead>
                    <tr>
                      <th />
                      {metrics.confusion.labels.map((l) => <th key={l} className="px-1 pb-1 font-medium text-ink/55"><span className="block w-12 truncate" title={CLASS_NAME(l)}>{CLASS_NAME(l)}</span></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.confusion.matrix.map((row, i) => {
                      const total = row.reduce((s, n) => s + n, 0) || 1;
                      return (
                        <tr key={i}>
                          <th className="pr-2 text-right font-medium text-ink/55">{CLASS_NAME(metrics.confusion.labels[i])}</th>
                          {row.map((n, j) => (
                            <td key={j} className="p-0.5">
                              <span
                                className={`grid h-9 w-12 place-items-center rounded-md font-semibold tabular-nums ${n / total > 0.5 ? "text-white" : "text-ink/70"}`}
                                style={{ background: i === j ? `color-mix(in srgb, var(--c-resolved) ${Math.round((n / total) * 100)}%, transparent)` : n ? `color-mix(in srgb, var(--c-alert) ${Math.max(12, Math.round((n / total) * 100))}%, transparent)` : "color-mix(in srgb, var(--c-ink) 4%, transparent)" }}
                              >
                                {n}
                              </span>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      ) : (
        status.available && (
          <div className="card flex gap-4 p-5">
            <FlaskConical size={22} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold">No test scores yet</p>
              <p className="mt-1 text-ink/60">Collect photos per category, run <code className="rounded bg-ink/8 px-1">ml/notebooks/train_civic_classifier.ipynb</code> on Google Colab and copy its two output files into <code className="rounded bg-ink/8 px-1">ml/models/</code>. Accuracy, per-category scores and the confusion matrix will appear here.</p>
            </div>
          </div>
        )
      )}

      <FixReview />

      {/* Real-world agreement */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center gap-5">
          <Ring value={stats?.civic.rate ?? null} size={104} tone="var(--c-accent)" label={`Agreement: ${stats?.civic.rate ?? "no data"}%`} />
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-2 text-lg font-semibold"><ScanSearch size={18} className="text-accent" aria-hidden /> In real use</h3>
            <p className="text-sm text-ink/60">How often the top suggestion matched the category people actually reported.</p>
            {stats && stats.total > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-resolved/12 px-2.5 py-1 font-medium text-resolved"><CheckCircle2 size={12} className="mr-1 inline" aria-hidden />Confident: {stats.confident.rate ?? "–"}% of {stats.confident.n}</span>
                <span className="rounded-full bg-marker/18 px-2.5 py-1 font-medium text-marker-dark">Unsure: {stats.unsure.rate ?? "–"}% of {stats.unsure.n}</span>
                <span className="rounded-full bg-ink/7 px-2.5 py-1 font-medium text-ink/65"><TriangleAlert size={12} className="mr-1 inline" aria-hidden />{stats.notCivic} sent despite a "not civic" warning</span>
                {stats.byMode.trained.n > 0 && <span className="rounded-full bg-accent/12 px-2.5 py-1 font-medium text-accent">Trained: {stats.byMode.trained.rate}% · Zero-shot: {stats.byMode["zero-shot"].rate ?? "–"}%</span>}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink/50">No reports with a suggestion yet. Submit a report with a photo while the Photo Assistant is running.</p>
            )}
          </div>
        </div>
        {stats && stats.total > 0 && (
          <ul className="mt-5 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            {stats.byCategory.filter((c) => c.n > 0).map((c) => (
              <li key={c.category} className="text-xs">
                <div className="flex justify-between"><span className="text-ink/70">{CLASS_NAME(c.category)}</span><span className="tabular-nums text-ink/55">{c.agreed}/{c.n} · {c.rate}%</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/8">
                  <div className="h-full origin-left rounded-full transition-transform duration-700" style={{ background: CATEGORY_COLOR[c.category], transform: `scaleX(${(c.rate ?? 0) / 100})` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
