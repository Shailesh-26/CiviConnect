import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRightLeft, BellOff, CalendarDays, Lock, Plane, Undo2, X } from "lucide-react";

const DAY = 86_400_000;
const isoDay = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const nice = (iso: string, plusDays = 0) => new Date(new Date(`${iso}T12:00:00`).getTime() + plusDays * DAY).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

// "Away for" choices; the value is the last day of leave (leave ends by itself at the end of that day).
const LENGTHS = [
  { label: "Today only", last: 0 },
  { label: "3 days", last: 2 },
  { label: "1 week", last: 6 },
  { label: "2 weeks", last: 13 },
] as const;
const REASONS = ["Personal work", "Medical", "Training", "Family function", "Official duty elsewhere"];

type Props = { open: boolean; who: string; self: boolean; openCount?: number; busy: boolean; onConfirm: (until: string | null, reason: string) => void; onCancel: () => void };

// Start leave for an officer: how long, why (seen by admins only), and what happens to their work.
export function LeaveDialog({ open, who, self, openCount, busy, onConfirm, onCancel }: Props) {
  const titleId = useId();
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [until, setUntil] = useState<string | null>(isoDay(2));
  const [custom, setCustom] = useState(false);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  const reasonError = tried && reason.trim().length < 3 ? "Say briefly why, for example \"Training\"" : null;
  const they = self ? "you" : "they";

  function submit() {
    setTried(true);
    if (reason.trim().length < 3) {
      reasonRef.current?.focus();
      return;
    }
    onConfirm(until, reason.trim());
  }

  return createPortal(
    <div className="fixed inset-0 z-[2500] grid place-items-center overflow-y-auto p-4" role="presentation">
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade" onClick={busy ? undefined : onCancel} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="card relative my-6 w-full max-w-lg overflow-hidden shadow-lift animate-pop">
        <div className="relative bg-signboard px-6 pb-5 pt-6 text-white">
          <div className="grid-paper pointer-events-none absolute inset-0 opacity-25" aria-hidden />
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Close" className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"><X size={17} aria-hidden /></button>
          <span className="relative grid size-11 place-items-center rounded-2xl bg-marker text-[#241a00] shadow-card"><Plane size={21} aria-hidden /></span>
          <h2 id={titleId} className="relative mt-3 text-2xl font-semibold">{self ? "Going on leave" : `Put ${who} on leave`}</h2>
          <p className="relative mt-1 text-sm text-white/70">{self ? "Your open work is looked after while you're away." : `${who}'s open work is looked after while they're away.`}</p>
        </div>

        <div className="space-y-5 p-6">
          <fieldset>
            <legend className="flex items-center gap-1.5 text-sm font-semibold"><CalendarDays size={15} aria-hidden /> How long?</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {LENGTHS.map((l) => {
                const value = isoDay(l.last);
                const on = !custom && until === value;
                return (
                  <button key={l.label} type="button" aria-pressed={on} onClick={() => { setCustom(false); setUntil(value); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? "border-accent bg-accent text-white" : "border-ink/15 hover:border-accent hover:text-accent"}`}>{l.label}</button>
                );
              })}
              <button type="button" aria-pressed={custom} onClick={() => { setCustom(true); setUntil(until ?? isoDay(2)); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${custom ? "border-accent bg-accent text-white" : "border-ink/15 hover:border-accent hover:text-accent"}`}>Pick a date</button>
              <button type="button" aria-pressed={!custom && until === null} onClick={() => { setCustom(false); setUntil(null); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${!custom && until === null ? "border-accent bg-accent text-white" : "border-ink/15 hover:border-accent hover:text-accent"}`}>Not sure yet</button>
            </div>
            {custom && (
              <label className="mt-3 block animate-fade">
                <span className="text-xs font-medium text-ink/65">Last day of leave</span>
                <input type="date" value={until ?? ""} min={isoDay(0)} max={isoDay(90)} onChange={(e) => setUntil(e.target.value || null)} className="input mt-1 !py-2 text-sm" />
              </label>
            )}
            <p className="mt-2 text-xs text-ink/60">
              {until ? <>Away until <span className="font-semibold text-ink">{nice(until)}</span>, back on <span className="font-semibold text-ink">{nice(until, 1)}</span>. Leave ends by itself.</> : `No end date: ${they} press "I'm back" when ${self ? "you return" : "they return"}.`}
            </p>
          </fieldset>

          <div>
            <label htmlFor={`${titleId}-reason`} className="text-sm font-semibold">Reason</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button key={r} type="button" onClick={() => { setReason(r); reasonRef.current?.focus(); }} className={`rounded-full border px-2.5 py-1 text-xs transition ${reason === r ? "border-accent bg-accent/10 font-semibold text-accent" : "border-ink/12 text-ink/70 hover:border-accent hover:text-accent"}`}>{r}</button>
              ))}
            </div>
            <textarea
              id={`${titleId}-reason`}
              ref={reasonRef}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="Or write a short reason"
              aria-invalid={reasonError ? true : undefined}
              className="input mt-2 text-sm"
            />
            <div className="mt-1 flex items-center justify-between text-[11px]">
              {reasonError ? <span className="text-alert animate-fade">{reasonError}</span> : <span className="inline-flex items-center gap-1 text-ink/50"><Lock size={11} aria-hidden /> Only admins see this. Colleagues and citizens don't.</span>}
              <span className="text-ink/45">{reason.length}/200</span>
            </div>
          </div>

          <ul className="space-y-2 rounded-2xl bg-ink/[0.04] p-3.5 text-xs text-ink/70">
            <li className="flex gap-2.5"><ArrowRightLeft size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden /><span>{openCount === undefined ? "Open issues go" : openCount === 0 ? "No open issues to hand over. Any would go" : `${openCount} open ${openCount === 1 ? "issue goes" : "issues go"}`} to the best available colleague straight away.</span></li>
            <li className="flex gap-2.5"><BellOff size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden /><span>Nothing new is assigned to {self ? "you" : "them"} until {they} {self ? "are" : "are"} back.</span></li>
            <li className="flex gap-2.5"><Undo2 size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden /><span>On return, issues nobody has started come back. Work a colleague has started stays with them.</span></li>
          </ul>
        </div>

        <div className="flex justify-end gap-2 border-t border-ink/8 px-6 py-4">
          <button type="button" onClick={onCancel} disabled={busy} className="btn btn-ghost">Cancel</button>
          <button type="button" onClick={submit} disabled={busy} className="btn btn-primary"><Plane size={16} aria-hidden /> {busy ? "Starting…" : "Start leave"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
