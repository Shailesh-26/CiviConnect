import { useState } from "react";
import { BadgeCheck, Bell, Camera, Check, Clock3, Layers, MapPin, ThumbsUp, Users, Wrench } from "lucide-react";
import { STATUS_META } from "../../lib/constants";
import { useInView, useInterval } from "../../lib/useInView";
import type { Status } from "../../types";
import { CategoryChip } from "../CategoryChip";
import { CountUp } from "../CountUp";
import { RoadArt } from "./RoadArt";

// One pothole's life, scripted with the real priority formula (pothole hazard 7 × 5 = 35, +3 per extra report,
// +1.5 per supporter, +1 per day open) and the real 72-hour pothole fix-by clock.
const SCRIPT: { status: Status; reports: number; supporters: number; priority: number; slaLeft: string; slaPct: number; note: { icon: typeof Bell; title: string; text: string; tone: string } }[] = [
  { status: "reported", reports: 1, supporters: 2, priority: 38, slaLeft: "72 h left", slaPct: 100, note: { icon: Camera, title: "Report received", text: "Ticket CC-0142 created with a photo and a pin.", tone: "bg-ink/10 text-ink" } },
  { status: "reported", reports: 3, supporters: 6, priority: 50, slaLeft: "70 h left", slaPct: 97, note: { icon: Layers, title: "2 nearby reports merged", text: "Same pothole, within 50 m. Priority went up.", tone: "bg-marker/25 text-marker-dark" } },
  { status: "acknowledged", reports: 3, supporters: 7, priority: 52, slaLeft: "58 h left", slaPct: 80, note: { icon: Users, title: "Assigned to Roads dept.", text: "Smart routing picked the officer with the lightest load.", tone: "bg-accent/15 text-accent" } },
  { status: "in_progress", reports: 3, supporters: 9, priority: 56, slaLeft: "31 h left", slaPct: 43, note: { icon: Wrench, title: "Work started on site", text: "Everyone following the issue was notified.", tone: "bg-marker/25 text-marker-dark" } },
  { status: "resolved", reports: 3, supporters: 9, priority: 56, slaLeft: "Fixed on time", slaPct: 43, note: { icon: BadgeCheck, title: "Fixed, with photo proof", text: "4 neighbours confirmed it is really gone.", tone: "bg-resolved/20 text-resolved" } },
];

const STEPS: Status[] = ["reported", "acknowledged", "in_progress", "resolved"];
const LABELS = ["Reported", "Assigned", "Working", "Fixed"];

export function HeroPreview() {
  const [ref, inView] = useInView({ threshold: 0.25 });
  const [stage, setStage] = useState(0);
  useInterval(() => setStage((s) => (s + 1) % SCRIPT.length), 2600, inView);

  const s = SCRIPT[stage];
  const stepIndex = STEPS.indexOf(s.status);
  const fixed = s.status === "resolved";
  const ring = 2 * Math.PI * 22;

  return (
    <div ref={ref} className={`relative ${inView ? "" : "cc-paused"}`}>
      {/* Window */}
      <div className="cc-par relative overflow-hidden rounded-[1.6rem] border border-ink/10 bg-surface shadow-lift" style={{ "--d": 10 } as React.CSSProperties}>
        <div className="flex items-center gap-2 border-b border-ink/10 bg-ink/[0.03] px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="mx-auto rounded-full bg-ink/6 px-3 py-0.5 text-[11px] text-ink/50">civiconnect / issues / CC-0142</span>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-[1.05fr_1fr]">
          <div className="relative overflow-hidden rounded-2xl">
            <RoadArt fixed={fixed} className="aspect-[4/3] h-full w-full" />
            <span key={fixed ? "after" : "before"} className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur animate-pop">
              {fixed ? "After · proof photo" : "Before · citizen photo"}
            </span>
            <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-[#17202b]">
              <MapPin size={11} aria-hidden /> Ameerpet main road
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <CategoryChip category="pothole" size="sm" />
              <div className="min-w-0">
                <p className="truncate font-display text-base font-semibold leading-tight">Pothole</p>
                <p className="text-[11px] text-ink/50">CC-0142 · Roads and Pavements</p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-500" style={{ background: `${STATUS_META[s.status].hex}22`, color: STATUS_META[s.status].hex }}>
                <span className="size-1.5 rounded-full" style={{ background: STATUS_META[s.status].hex }} />
                {STATUS_META[s.status].label}
              </span>
              <span key={s.reports} className="inline-flex items-center gap-1 rounded-full bg-ink/6 px-2 py-1 text-[11px] font-medium text-ink/70 animate-pop">
                <Layers size={12} aria-hidden /> {s.reports} {s.reports === 1 ? "report" : "reports"}
              </span>
            </div>

            <div className="mt-3">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-ink/55">Priority score</span>
                <span className="font-display text-lg font-bold"><CountUp value={s.priority} /></span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/8">
                <div className="h-full origin-left rounded-full bg-gradient-to-r from-marker to-alert transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)]" style={{ transform: `scaleX(${s.priority / 100})` }} />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3 rounded-xl bg-ink/[0.04] p-2.5">
              <svg viewBox="0 0 52 52" className="size-11 -rotate-90" aria-hidden>
                <circle cx="26" cy="26" r="22" fill="none" stroke="currentColor" strokeOpacity=".1" strokeWidth="5" />
                <circle
                  cx="26" cy="26" r="22" fill="none" strokeWidth="5" strokeLinecap="round"
                  stroke={fixed ? "var(--c-resolved)" : s.slaPct < 50 ? "var(--c-marker)" : "var(--c-accent)"}
                  strokeDasharray={ring}
                  strokeDashoffset={ring * (1 - s.slaPct / 100)}
                  style={{ transition: "stroke-dashoffset .9s cubic-bezier(.22,1,.36,1), stroke .5s" }}
                />
              </svg>
              <div className="min-w-0 text-xs">
                <p className="flex items-center gap-1 text-ink/55"><Clock3 size={12} aria-hidden /> Fix-by clock</p>
                <p className="font-semibold">{s.slaLeft}</p>
              </div>
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink/55"><ThumbsUp size={12} aria-hidden /> <CountUp value={s.supporters} /></span>
            </div>

            {/* Status tracker */}
            <div className="relative mt-4 flex justify-between">
              <div className="absolute inset-x-3 top-3 h-0.5 rounded-full bg-ink/10" />
              <div className="absolute left-3 right-3 top-3 h-0.5 origin-left rounded-full bg-resolved transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)]" style={{ transform: `scaleX(${stepIndex / (STEPS.length - 1)})` }} />
              {STEPS.map((step, i) => (
                <div key={step} className="relative flex w-14 flex-col items-center text-center">
                  <span className={`grid size-6 place-items-center rounded-full border-2 transition-all duration-500 ${i <= stepIndex ? "scale-100 border-resolved bg-resolved text-white" : "scale-90 border-ink/15 bg-surface text-transparent"}`}>
                    <Check size={13} strokeWidth={3} aria-hidden />
                  </span>
                  <span className={`mt-1 text-[10px] leading-tight transition-colors ${i <= stepIndex ? "text-ink/80" : "text-ink/40"}`}>{LABELS[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating live notification */}
      <div className="cc-par pointer-events-none absolute -right-2 -top-12 w-64 sm:-right-8" style={{ "--d": 26 } as React.CSSProperties}>
        <div key={stage} className="glass flex gap-3 rounded-2xl border border-ink/10 p-3 shadow-lift cc-toast-in">
          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${s.note.tone}`}><s.note.icon size={17} aria-hidden /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">{s.note.title}</p>
            <p className="mt-0.5 text-xs text-ink/60">{s.note.text}</p>
          </div>
        </div>
      </div>

      {/* Floating progress dots: click to jump to a moment */}
      <div className="absolute inset-x-0 -bottom-5 flex justify-center">
        <div className="cc-par glass flex items-center gap-1.5 rounded-full border border-ink/10 px-3 py-2 shadow-card">
          {SCRIPT.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStage(i)}
              aria-label={`Show step ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-500 ${i === stage ? "w-6 bg-accent" : "w-2 bg-ink/20 hover:bg-ink/40"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
