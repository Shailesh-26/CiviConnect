import { useState } from "react";
import { Award, Bell, Camera, Clock3, Gauge, Layers, Radio, ShieldCheck, Siren, Wrench } from "lucide-react";
import { CATEGORY_COLOR } from "../../lib/constants";
import { useInView, useInterval } from "../../lib/useInView";
import { PriorityPlayground } from "./PriorityPlayground";
import { ProofSlider } from "./ProofSlider";

function Tile({ icon: Icon, kicker, title, text, className = "", children, delay = 0 }: { icon: typeof Bell; kicker: string; title: string; text: string; className?: string; children: React.ReactNode; delay?: number }) {
  return (
    <article className={`reveal card card-hover flex flex-col overflow-hidden p-5 sm:p-6 ${className}`} style={{ "--rd": `${delay}ms` } as React.CSSProperties}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent"><Icon size={14} aria-hidden /> {kicker}</p>
      <h3 className="mt-2 text-xl font-semibold sm:text-2xl">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-ink/60">{text}</p>
      <div className="mt-5 flex-1">{children}</div>
    </article>
  );
}

// Three reports of the same drain flow into one issue.
function MergeDemo() {
  const [ref, inView] = useInView({ threshold: 0.3 });
  return (
    <div ref={ref} className={`relative grid h-48 place-items-center overflow-hidden rounded-2xl bg-ink/[0.035] ${inView ? "" : "cc-paused"}`}>
      <div className="grid-paper absolute inset-0 opacity-60" aria-hidden />
      <svg viewBox="-150 -110 300 220" className="relative h-full w-full" aria-hidden>
        <circle r="50" fill="none" stroke="var(--c-accent)" strokeOpacity=".35" strokeDasharray="4 6" />
        <text y="68" textAnchor="middle" fontSize="10" fill="currentColor" opacity=".45">50 m merge radius</text>
        <g className="cc-merge-glow"><circle r="26" fill={CATEGORY_COLOR.drainage} opacity=".18" /></g>
        {["cc-merge-a", "cc-merge-b", "cc-merge-c"].map((cls) => (
          <g key={cls} className={cls}>
            <path d="M0-26c-8 0-14 6-14 13 0 10 14 21 14 21s14-11 14-21c0-7-6-13-14-13z" fill={CATEGORY_COLOR.drainage} stroke="#fff" strokeWidth="2" />
            <circle cy="-13" r="4.5" fill="#fff" />
          </g>
        ))}
      </svg>
      <span className="cc-merge-badge absolute bottom-3 right-3 rounded-full bg-surface px-3 py-1 text-xs font-semibold shadow-card">3 reports → 1 issue</span>
    </div>
  );
}

// The fix-by clock drains, warns, then escalates.
function SlaDemo() {
  const [ref, inView] = useInView({ threshold: 0.3 });
  const len = 2 * Math.PI * 46;
  return (
    <div ref={ref} className={`flex items-center gap-5 ${inView ? "" : "cc-paused"}`}>
      <div className="relative size-32 shrink-0">
        <svg viewBox="0 0 110 110" className="size-full -rotate-90" aria-hidden>
          <circle cx="55" cy="55" r="46" fill="none" stroke="currentColor" strokeOpacity=".08" strokeWidth="9" />
          <circle cx="55" cy="55" r="46" fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={len} className="cc-sla-ring" style={{ "--len": len } as React.CSSProperties} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <Clock3 size={18} className="mx-auto text-ink/45" aria-hidden />
            <p className="cc-sla-text mt-0.5 text-[11px] font-semibold" />
          </div>
        </div>
      </div>
      <ul className="space-y-1.5 text-xs">
        {[
          ["Fallen tree", "24 h"],
          ["Drainage · Garbage", "48 h"],
          ["Pothole · Street light", "72 h"],
        ].map(([k, v]) => (
          <li key={k} className="flex gap-3"><span className="w-32 min-w-0 text-ink/60">{k}</span><span className="shrink-0 whitespace-nowrap font-semibold tabular-nums">{v}</span></li>
        ))}
        <li className="cc-sla-escalate inline-flex items-center gap-1 rounded-full bg-alert px-2.5 py-1 font-semibold text-white"><Siren size={12} aria-hidden /> Escalated · +15 priority</li>
      </ul>
    </div>
  );
}

const PINGS = [
  { icon: Wrench, text: "Work started on your drainage report", tone: "text-marker-dark bg-marker/20" },
  { icon: Bell, text: "Officer replied in the discussion", tone: "text-accent bg-accent/12" },
  { icon: ShieldCheck, text: "Street light near you was fixed", tone: "text-resolved bg-resolved/15" },
  { icon: Siren, text: "CC-0087 is overdue and escalated", tone: "text-alert bg-alert/10" },
  { icon: Layers, text: "Someone else reported your pothole too", tone: "text-accent bg-accent/12" },
];

// Notifications slide in on their own, the way they do in the app.
function LiveDemo() {
  const [ref, inView] = useInView({ threshold: 0.3 });
  const [n, setN] = useState(3);
  useInterval(() => setN((v) => v + 1), 1900, inView);
  const shown = [0, 1, 2].map((k) => ({ id: n - k, ...PINGS[(n - k) % PINGS.length] }));
  return (
    <div ref={ref} className="relative h-44">
      {shown.map((p, k) => (
        <div
          key={p.id}
          className="cc-stack absolute inset-x-0 flex items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-3 shadow-card"
          style={{ transform: `translateY(${k * 54}px) scale(${1 - k * 0.04})`, opacity: 1 - k * 0.28, zIndex: 3 - k }}
        >
          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${p.tone}`}><p.icon size={17} aria-hidden /></span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.text}</span>
          <span className="text-[11px] text-ink/45">{k === 0 ? "now" : `${k * 2} min`}</span>
        </div>
      ))}
    </div>
  );
}

const WEIGHTS = [
  { k: "Fixed on time", w: 35, c: "var(--c-resolved)" },
  { k: "Share fixed", w: 30, c: "var(--c-accent)" },
  { k: "Speed", w: 20, c: "var(--c-marker)" },
  { k: "Stayed fixed", w: 15, c: "#6250d6" },
];

// What an area grade is made of.
function GradeDemo() {
  const [ref, inView] = useInView({ once: true, threshold: 0.4 });
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div ref={ref} className="flex items-center gap-5">
      <div className="relative grid size-28 shrink-0 place-items-center rounded-3xl bg-signboard text-white shadow-lift">
        <span className={`font-display text-6xl font-bold transition-all duration-700 ${inView ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}>B</span>
        <span className="absolute bottom-2 text-[10px] uppercase tracking-widest text-white/60">Area grade</span>
      </div>
      <ul className="flex-1 space-y-2" onMouseLeave={() => setHover(null)}>
        {WEIGHTS.map((x, i) => (
          <li key={x.k} onMouseEnter={() => setHover(i)} className={`transition-opacity duration-300 ${hover !== null && hover !== i ? "opacity-40" : ""}`}>
            <div className="flex justify-between text-xs"><span className="text-ink/65">{x.k}</span><span className="font-semibold tabular-nums">{x.w}%</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/8">
              <div className="h-full origin-left rounded-full transition-transform duration-1000 ease-[cubic-bezier(.22,1,.36,1)]" style={{ background: x.c, transform: `scaleX(${inView ? x.w / 35 : 0})`, transitionDelay: `${i * 120}ms` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FeatureBento() {
  return (
    <div className="grid gap-4 md:grid-cols-6">
      <Tile icon={Gauge} kicker="Priority" title="A priority you can explain" text="No black box. Drag the sliders: this is the exact formula the server uses to rank every issue." className="md:col-span-4">
        <PriorityPlayground />
      </Tile>
      <Tile icon={Layers} kicker="De-duplication" title="Duplicates merge themselves" text="Reports within 50 m of an open issue join it. One queue item, louder voice." className="md:col-span-2" delay={80}>
        <MergeDemo />
      </Tile>
      <Tile icon={Clock3} kicker="SLA engine" title="Every issue has a fix-by clock" text="Warned at 25% time left. Overdue issues escalate automatically, every minute, without anyone pressing a button." className="md:col-span-3">
        <SlaDemo />
      </Tile>
      <Tile icon={Camera} kicker="Proof" title="Closed only with a photo" text="Officers attach proof. If the reporter, or two neighbours, say it's still broken, it reopens." className="md:col-span-3" delay={80}>
        <ProofSlider />
      </Tile>
      <Tile icon={Radio} kicker="Real time" title="Live, without refreshing" text="Status changes, replies and escalations reach the right people the moment they happen." className="md:col-span-3">
        <LiveDemo />
      </Tile>
      <Tile icon={Award} kicker="Accountability" title="Every area gets a report card" text="Wards are graded on what actually matters to residents. Hover a bar to see its weight." className="md:col-span-3" delay={80}>
        <GradeDemo />
      </Tile>
    </div>
  );
}
