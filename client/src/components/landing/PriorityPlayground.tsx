import { useState } from "react";
import { CATEGORIES, CATEGORY_COLOR } from "../../lib/constants";
import type { Category } from "../../types";
import { CategoryIcon } from "../CategoryIcon";
import { CountUp } from "../CountUp";

// The exact formula the server uses (server/src/utils/priority.ts), so visitors can play with it.
const HAZARD: Record<Category, number> = { fallen_tree: 9, drainage: 8, pothole: 7, streetlight: 6, garbage: 5, other: 4 };

function Slider({ label, value, max, onChange, hint }: { label: string; value: number; max: number; onChange: (n: number) => void; hint: string }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-ink/70">{label}</span>
        <span className="tabular-nums text-ink/50">{value}{value === max ? "+" : ""} · {hint}</span>
      </span>
      <input type="range" min={0} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="cc-range mt-1.5 w-full" style={{ "--p": `${(value / max) * 100}%` } as React.CSSProperties} />
    </label>
  );
}

export function PriorityPlayground() {
  const [category, setCategory] = useState<Category>("drainage");
  const [reports, setReports] = useState(3);
  const [support, setSupport] = useState(4);
  const [days, setDays] = useState(2);
  const [escalated, setEscalated] = useState(false);
  const [emergency, setEmergency] = useState(false);

  const parts = [
    { key: "Hazard", value: HAZARD[category] * 5, color: CATEGORY_COLOR[category] },
    { key: "Reports", value: Math.min(Math.max(reports - 1, 0), 10) * 3, color: "#8b95a7" },
    { key: "Support", value: Math.min(support, 10) * 1.5, color: "var(--c-resolved)" },
    { key: "Age", value: Math.min(days, 10), color: "var(--c-marker)" },
    { key: "Overdue", value: escalated ? 15 : 0, color: "var(--c-alert)" },
    { key: "Emergency", value: emergency ? 25 : 0, color: "#7a1f16" },
  ];
  const raw = parts.reduce((sum, p) => sum + p.value, 0);
  const score = Math.round(Math.min(100, raw));
  const label = score >= 70 ? { text: "High", cls: "bg-alert/12 text-alert" } : score >= 40 ? { text: "Medium", cls: "bg-marker/20 text-marker-dark" } : { text: "Low", cls: "bg-accent/12 text-accent" };
  const scale = raw > 100 ? 100 / raw : 1;

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_1.15fr]">
      <div>
        <div className="flex items-end gap-3">
          <p className="font-display text-7xl font-bold leading-none tracking-tight"><CountUp value={score} /></p>
          <div className="pb-1.5">
            <span key={label.text} className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold animate-pop ${label.cls}`}>{label.text} priority</span>
            <p className="mt-1 text-xs text-ink/50">out of 100</p>
          </div>
        </div>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-ink/8">
          {parts.map((p) => (
            <span key={p.key} className="h-full transition-[width] duration-500 ease-[cubic-bezier(.22,1,.36,1)]" style={{ width: `${p.value * scale}%`, background: p.color }} />
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {parts.map((p) => (
            <li key={p.key} className={`flex items-center gap-1.5 transition-opacity ${p.value ? "" : "opacity-40"}`}>
              <span className="size-2 rounded-full" style={{ background: p.color }} />
              <span className="text-ink/60">{p.key}</span>
              <span className="ml-auto tabular-nums font-semibold">+{p.value % 1 ? p.value.toFixed(1) : p.value}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const on = c.value === category;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-300 ${on ? "scale-105 border-transparent text-white shadow-card" : "border-ink/12 text-ink/70 hover:border-ink/30"}`}
                style={on ? { background: CATEGORY_COLOR[c.value] } : undefined}
              >
                <CategoryIcon category={c.value} size={13} /> {c.label}
              </button>
            );
          })}
        </div>
        <Slider label="People who reported it" value={reports} max={11} onChange={setReports} hint="+3 each after the first" />
        <Slider label="Neighbours who backed it" value={support} max={10} onChange={setSupport} hint="+1.5 each" />
        <Slider label="Days open" value={days} max={10} onChange={setDays} hint="+1 a day" />
        {[
          { label: "Missed its fix-by time (escalated)", on: escalated, set: setEscalated },
          { label: "Emergency: danger to people right now", on: emergency, set: setEmergency },
        ].map((t) => (
          <label key={t.label} className="flex cursor-pointer items-center justify-between rounded-xl bg-ink/[0.04] px-3 py-2 text-xs">
            <span className="font-medium text-ink/70">{t.label}</span>
            <input type="checkbox" checked={t.on} onChange={(e) => t.set(e.target.checked)} className="peer sr-only" />
            <span className="relative h-5 w-9 rounded-full bg-ink/20 transition-colors peer-checked:bg-alert peer-focus-visible:ring-2 peer-focus-visible:ring-accent after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-300 peer-checked:after:translate-x-4" />
          </label>
        ))}
      </div>
    </div>
  );
}
