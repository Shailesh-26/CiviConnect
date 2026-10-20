import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileSpreadsheet, FileText, X } from "lucide-react";
import { api } from "../lib/api";

const DAY = 86_400_000;
// YYYY-MM-DD in India time.
const ymd = (offsetDays = 0) => new Date(Date.now() + offsetDays * DAY + 5.5 * 3_600_000).toISOString().slice(0, 10);

const PERIODS = [
  { id: "today", label: "Today", range: () => [ymd(), ymd()] },
  { id: "7d", label: "Last 7 days", range: () => [ymd(-6), ymd()] },
  { id: "30d", label: "Last 30 days", range: () => [ymd(-29), ymd()] },
  { id: "month", label: "This month", range: () => [`${ymd().slice(0, 8)}01`, ymd()] },
  { id: "custom", label: "Pick dates", range: () => ["", ""] },
  { id: "all", label: "All time", range: () => ["", ""] },
] as const;
const ROLES = [
  { id: "", label: "Everyone" },
  { id: "admin", label: "Admins" },
  { id: "officer", label: "Officers" },
  { id: "citizen", label: "Citizens" },
  { id: "system", label: "System" },
];

type Props = {
  open: boolean;
  actions: { id: string; label: string }[];
  defaultAction: string;
  onClose: () => void;
  onPdf: (params: URLSearchParams, label: string) => void;
};

function Chips<T extends string>({ value, options, onChange }: { value: T; options: readonly { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.id || "all"} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${value === o.id ? "border-accent bg-accent text-white" : "border-ink/15 hover:border-accent hover:text-accent"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Choose exactly which part of the audit log to download, see how many entries match, then CSV or PDF.
export function AuditExportDialog({ open, actions, defaultAction, onClose, onPdf }: Props) {
  const titleId = useId();
  const [action, setAction] = useState(defaultAction);
  const [role, setRole] = useState("");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("30d");
  const [from, setFrom] = useState(ymd(-29));
  const [to, setTo] = useState(ymd());
  const [format, setFormat] = useState<"csv" | "pdf">("csv");
  const [count, setCount] = useState<{ key: string; total: number } | null>(null);

  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (role) params.set("role", role);
  if (period !== "all" && from) params.set("from", from);
  if (period !== "all" && to) params.set("to", to);
  const key = params.toString();

  // How many entries match, updated as choices change.
  useEffect(() => {
    if (!open) return;
    let active = true;
    const t = window.setTimeout(() => {
      api<{ total: number }>(`/admin/audit/export?${key}${key ? "&" : ""}format=count`).then((d) => active && setCount({ key, total: d.total })).catch(() => undefined);
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [open, key]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const total = count?.key === key ? count.total : null;
  const badRange = Boolean(from && to && from > to);
  const label = [actions.find((a) => a.id === action)?.label ?? "Everything", ROLES.find((r) => r.id === role && r.id)?.label, period === "all" ? "all time" : `${from || "start"} to ${to || "today"}`].filter(Boolean).join(" - ");

  function download() {
    if (format === "csv") {
      window.location.href = `/api/admin/audit/export${key ? `?${key}` : ""}`;
      onClose();
    } else {
      onPdf(new URLSearchParams(key), label);
      onClose();
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[2500] grid place-items-center overflow-y-auto p-4" role="presentation">
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="card relative my-6 w-full max-w-lg p-6 shadow-lift animate-pop">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-ink/50 hover:bg-ink/6 hover:text-ink"><X size={17} aria-hidden /></button>
        <h2 id={titleId} className="text-xl font-semibold">Export the audit log</h2>
        <p className="mt-1 text-sm text-ink/60">Choose what to include. Only matching entries are downloaded.</p>

        <div className="mt-5 space-y-4">
          <div>
            <p className="text-sm font-semibold">What</p>
            <Chips value={action} options={actions} onChange={setAction} />
          </div>
          <div>
            <p className="text-sm font-semibold">Who did it</p>
            <Chips value={role} options={ROLES} onChange={setRole} />
          </div>
          <div>
            <p className="text-sm font-semibold">When</p>
            <Chips
              value={period}
              options={PERIODS}
              onChange={(p) => {
                setPeriod(p);
                const [f, t] = PERIODS.find((x) => x.id === p)!.range();
                if (p !== "custom") {
                  setFrom(f);
                  setTo(t);
                }
              }}
            />
            {period === "custom" && (
              <div className="mt-3 grid grid-cols-2 gap-3 animate-fade">
                <label className="text-xs font-medium text-ink/65">From<input type="date" value={from} max={to || ymd()} onChange={(e) => setFrom(e.target.value)} className="input mt-1 !py-2 text-sm" /></label>
                <label className="text-xs font-medium text-ink/65">To<input type="date" value={to} min={from} max={ymd()} onChange={(e) => setTo(e.target.value)} className="input mt-1 !py-2 text-sm" /></label>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">Format</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([
                { id: "csv", label: "CSV", hint: "For Excel. Every matching entry.", icon: FileSpreadsheet },
                { id: "pdf", label: "PDF", hint: "To print or share. Up to 2,000 entries.", icon: FileText },
              ] as const).map((f) => (
                <button key={f.id} type="button" aria-pressed={format === f.id} onClick={() => setFormat(f.id)} className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${format === f.id ? "border-accent bg-accent/8" : "border-ink/12 hover:border-ink/30"}`}>
                  <f.icon size={18} className={format === f.id ? "text-accent" : "text-ink/50"} aria-hidden />
                  <span><span className="block text-sm font-semibold">{f.label}</span><span className="block text-[11px] text-ink/55">{f.hint}</span></span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-ink/8 pt-4">
          <p className="text-sm text-ink/65" aria-live="polite">
            {badRange ? <span className="text-alert">"From" is after "To".</span> : total === null ? "Counting…" : <><span className="font-semibold text-ink">{total.toLocaleString("en-IN")}</span> {total === 1 ? "entry matches" : "entries match"}</>}
          </p>
          <button type="button" onClick={download} disabled={badRange || total === 0} className="btn btn-primary"><Download size={16} aria-hidden /> Download {format.toUpperCase()}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
