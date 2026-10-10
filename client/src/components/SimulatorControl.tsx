import { useCallback, useEffect, useState } from "react";
import { Play, Sparkles, Square } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useLiveRefresh } from "../lib/useLiveRefresh";
import { useToast } from "../lib/toast-context";
import type { SimulatorStatus } from "../types";

const PACES = [
  { s: 4, label: "Fast" },
  { s: 8, label: "Normal" },
  { s: 15, label: "Calm" },
];

// Admin switch for the live demo simulator: the demo city starts acting on its own.
export function SimulatorControl() {
  const toast = useToast();
  const [status, setStatus] = useState<SimulatorStatus | null>(null);
  const [pace, setPace] = useState(8);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<SimulatorStatus>("/insights/simulator").then(setStatus).catch(() => undefined);
  }, []);
  useEffect(load, [load]);
  useLiveRefresh(load, 30_000);

  async function toggle() {
    setBusy(true);
    try {
      const next = await api<SimulatorStatus>("/insights/simulator", { method: "POST", body: { action: status?.running ? "stop" : "start", everySeconds: pace } });
      setStatus(next);
      toast.info(next.running ? "Demo citizens, officers and the admin will act every few seconds. Watch the bell and this page." : `Stopped after ${next.actions} actions.`, { title: next.running ? "Simulator running" : "Simulator stopped" });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not change the simulator.");
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-2xl border px-2 py-1.5 text-xs ${status.running ? "border-marker/50 bg-marker/12" : "border-ink/10 bg-surface"}`}>
      <Sparkles size={15} className={status.running ? "animate-pulse text-marker-dark" : "text-ink/45"} aria-hidden />
      {status.running ? (
        <span className="max-w-64 truncate font-medium" title={status.last ?? undefined}>
          Simulating · {status.actions} actions{status.last ? ` · ${status.last}` : ""}
        </span>
      ) : (
        <>
          <span className="font-medium text-ink/65">Demo simulator</span>
          <select value={pace} onChange={(e) => setPace(Number(e.target.value))} aria-label="Pace" className="rounded-lg border border-ink/12 bg-surface px-1.5 py-1 text-xs">
            {PACES.map((p) => <option key={p.s} value={p.s}>{p.label}</option>)}
          </select>
        </>
      )}
      <button type="button" onClick={toggle} disabled={busy} className={`btn !rounded-xl !px-2.5 !py-1 text-xs ${status.running ? "bg-alert text-white" : "btn-marker"}`}>
        {status.running ? <Square size={13} aria-hidden /> : <Play size={13} aria-hidden />} {status.running ? "Stop" : "Start"}
      </button>
    </div>
  );
}
