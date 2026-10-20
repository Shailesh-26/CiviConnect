import { createElement, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, Check, Radio, UserRound } from "lucide-react";
import { CATEGORY_COLOR } from "../../lib/constants";
import { useInView, useInterval } from "../../lib/useInView";
import type { Category } from "../../types";
import { CategoryIcon } from "../CategoryIcon";
import { RoadArt } from "./RoadArt";

const ROLES = [
  {
    id: "citizen",
    label: "Citizens",
    icon: UserRound,
    title: "Report in a minute. Follow it to the end.",
    points: [
      "Five-step wizard: photo, problem, pin, details, review",
      "Neighbourhood feed of everything within 2 km",
      "Back other reports, follow them, join the discussion",
      "Verify the fix, or reopen it if it's still broken",
    ],
    cta: { to: "/register", text: "Create a free account" },
  },
  {
    id: "officer",
    label: "Officers",
    icon: BriefcaseBusiness,
    title: "A desk that tells you what to fix next.",
    points: [
      "Queue sorted by time left on each fix-by clock",
      "Today's route, nearest stop first",
      "Log problems found during field inspections",
      "Close with a proof photo; citizens are told instantly",
    ],
    cta: { to: "/login", text: "Officer log in" },
  },
  {
    id: "admin",
    label: "Admins",
    icon: Radio,
    title: "Run the whole city from one command center.",
    points: [
      "One-click assignment with smart officer suggestions",
      "Overdue board, live map and SLA settings per category",
      "Moderation queue, audit log of every action",
      "Analytics, area report cards and CSV export",
    ],
    cta: { to: "/login", text: "Admin log in" },
  },
] as const;

type RoleId = (typeof ROLES)[number]["id"];

// A tiny looping walk through the real report wizard: photo, problem, pin, details, submitted.
const STEPS = ["Photo", "Problem", "Location", "Details", "Review"];
const CATS: Category[] = ["pothole", "drainage", "garbage", "fallen_tree", "streetlight", "other"];
const catName = (c: Category) => (c === "fallen_tree" ? "Fallen tree" : c === "streetlight" ? "Street light" : c[0].toUpperCase() + c.slice(1));

function CitizenScreen() {
  const [ref, inView] = useInView({ threshold: 0.3 });
  const [step, setStep] = useState(0);
  useInterval(() => setStep((s) => (s + 1) % STEPS.length), 1500, inView);

  return (
    <div ref={ref} className="space-y-3">
      <div className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full origin-left rounded-full bg-accent transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)]" style={{ transform: `scaleX(${i <= step ? 1 : 0})` }} />
            </div>
            <p className={`mt-1 text-[10px] transition-colors ${i === step ? "font-semibold text-accent" : "text-ink/50"}`}>{s}</p>
          </div>
        ))}
      </div>
      <div key={step} className="min-h-40 animate-fade">
        {step === 0 && (
          <div className="relative h-40 overflow-hidden rounded-xl">
            <RoadArt className="block h-full w-full" />
            <div className="cc-scan pointer-events-none absolute inset-0" aria-hidden />
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-card animate-pop [animation-delay:700ms]" style={{ background: CATEGORY_COLOR.pothole }}>Pothole · 87%</span>
          </div>
        )}
        {step === 1 && (
          <>
            <p className="font-display text-base font-semibold">What's the problem?</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {CATS.map((c) => (
                <div key={c} className={`grid place-items-center gap-1 rounded-xl border p-2.5 text-[11px] font-medium transition-all duration-300 ${c === "pothole" ? "scale-105 border-transparent text-white shadow-card" : "border-ink/10 text-ink/60"}`} style={c === "pothole" ? { background: CATEGORY_COLOR[c] } : undefined}>
                  <CategoryIcon category={c} size={18} />
                  {catName(c)}
                </div>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <div className="relative h-40 overflow-hidden rounded-xl bg-ink/[0.04]">
            <div className="grid-paper absolute inset-0" aria-hidden />
            <svg viewBox="0 0 200 120" className="absolute inset-0 size-full" preserveAspectRatio="none" aria-hidden>
              <path d="M0 70 H200 M80 0 V120 M150 0 V120" stroke="var(--c-ink)" strokeOpacity=".12" strokeWidth="9" />
            </svg>
            <span className="cc-pin-drop absolute left-[42%] top-[58%] grid size-8 place-items-center rounded-full rounded-bl-none -rotate-45 text-white shadow-card" style={{ background: CATEGORY_COLOR.pothole }}>
              <span className="rotate-45"><CategoryIcon category="pothole" size={14} /></span>
            </span>
            <span className="absolute bottom-2 left-2 rounded-lg bg-surface px-2 py-1 text-[11px] font-medium shadow-card animate-pop [animation-delay:600ms]">Near Ameerpet metro station</span>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-2 rounded-xl border border-ink/10 p-3">
            <p className="text-[11px] font-semibold text-ink/60">Describe it</p>
            <p className="cc-type inline-block max-w-full overflow-hidden whitespace-nowrap border-r-2 border-accent pr-0.5 text-xs text-ink/80">Deep pothole in the left lane, bikes swerving.</p>
            <div className="flex items-center justify-between rounded-lg bg-ink/[0.04] px-2 py-1.5 text-[11px] text-ink/60">
              Is anyone in danger right now? <span className="rounded-full bg-ink/10 px-2 py-0.5 font-semibold">No</span>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="grid h-40 place-items-center rounded-xl bg-resolved/8 text-center">
            <div>
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-resolved text-white shadow-card animate-pop"><Check size={24} strokeWidth={3} aria-hidden /></span>
              <p className="mt-2 font-display text-base font-semibold">Submitted · CC-0142</p>
              <p className="text-[11px] text-ink/55">You'll be told at every step until it's fixed.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OfficerScreen() {
  const rows: [Category, string, string, string][] = [
    ["drainage", "Drainage · Kukatpally", "Overdue 3 h", "bg-alert/12 text-alert"],
    ["pothole", "Pothole · Ameerpet", "5 h left", "bg-marker/20 text-marker-dark"],
    ["streetlight", "Street light · SR Nagar", "2 d left", "bg-resolved/15 text-resolved"],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr]">
      <ol className="space-y-2">
        {rows.map(([c, t, sla, tone], i) => (
          <li key={t} className="cc-row-in flex items-center gap-2 rounded-xl border border-ink/10 bg-surface p-2" style={{ animationDelay: `${i * 120}ms` }}>
            <span className="grid size-6 place-items-center rounded-full bg-ink/8 text-[11px] font-bold">{i + 1}</span>
            <span className="grid size-7 place-items-center rounded-lg" style={{ background: `${CATEGORY_COLOR[c]}22`, color: CATEGORY_COLOR[c] }}><CategoryIcon category={c} size={14} /></span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium">{t}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{sla}</span>
          </li>
        ))}
      </ol>
      <div className="relative overflow-hidden rounded-xl bg-ink/[0.04]">
        <div className="grid-paper absolute inset-0" aria-hidden />
        <svg viewBox="0 0 120 100" className="relative h-full min-h-28 w-full" aria-hidden>
          <path d="M18 78 C40 70 38 40 60 44 S92 30 100 18" fill="none" stroke="var(--c-accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray="160" className="cc-route" />
          {[[18, 78, CATEGORY_COLOR.drainage], [60, 44, CATEGORY_COLOR.pothole], [100, 18, CATEGORY_COLOR.streetlight]].map(([x, y, c], i) => (
            <g key={i}>
              <circle cx={x as number} cy={y as number} r="7" fill={c as string} stroke="#fff" strokeWidth="2" />
              <text x={x as number} y={(y as number) + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">{i + 1}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function AdminScreen() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {["Unassigned", "Ravi · Roads", "Sana · Sanitation"].map((lane, i) => (
        <div key={lane} className="relative min-h-40 rounded-xl bg-ink/[0.04] p-2">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-ink/50">{lane}</p>
          <div className="mt-2 space-y-1.5">
            {i === 0 && <div className="cc-assign relative z-10 rounded-lg border border-accent/40 bg-surface p-2 text-[11px] font-medium shadow-card">Garbage · CC-0193<span className="mt-0.5 block text-[10px] font-normal text-accent">Suggested: Sana</span></div>}
            {i > 0 && Array.from({ length: i === 1 ? 2 : 1 }, (_, k) => (
              <div key={k} className="rounded-lg border border-ink/10 bg-surface p-2 text-[11px] text-ink/60">{k ? "Drainage" : i === 1 ? "Pothole" : "Garbage"} · CC-01{4 + k}{i}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const SCREENS: Record<RoleId, () => React.ReactElement> = { citizen: CitizenScreen, officer: OfficerScreen, admin: AdminScreen };

export function RoleTabs() {
  const [ref, inView] = useInView({ threshold: 0.35 });
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useInterval(() => setIndex((i) => (i + 1) % ROLES.length), 7000, inView && !paused);
  // The header's Product menu can ask for a role ("Report wizard" shows the citizen's screen).
  useEffect(() => {
    const show = (e: Event) => {
      const i = ROLES.findIndex((r) => r.id === (e as CustomEvent<string>).detail);
      if (i >= 0) setIndex(i);
    };
    window.addEventListener("cc:show-role", show);
    return () => window.removeEventListener("cc:show-role", show);
  }, []);
  const role = ROLES[index];

  return (
    <div ref={ref} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div role="tablist" aria-label="Who it's for" className="relative mx-auto grid max-w-xl grid-cols-3 rounded-full border border-ink/10 bg-surface p-1 shadow-card">
        <span className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-signboard shadow-card transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)]" style={{ transform: `translateX(${index * 100}%)` }} aria-hidden />
        {ROLES.map((r, i) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            onClick={() => setIndex(i)}
            className={`relative z-10 flex items-center justify-center gap-1.5 overflow-hidden rounded-full px-2 py-2.5 text-sm font-semibold transition-colors duration-300 ${i === index ? "text-white" : "text-ink/65 hover:text-ink"}`}
          >
            <r.icon size={16} aria-hidden /> <span className="truncate">{r.label}</span>
            {i === index && inView && !paused && <span key={`${index}`} className="cc-tab-timer absolute inset-x-4 bottom-1 h-0.5 origin-left rounded-full bg-marker" aria-hidden />}
          </button>
        ))}
      </div>

      <div key={role.id} className="mt-10 grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div className="animate-page">
          <h3 className="text-3xl font-semibold sm:text-4xl">{role.title}</h3>
          <ul className="mt-6 space-y-3">
            {role.points.map((p, i) => (
              <li key={p} className="cc-row-in flex gap-3" style={{ animationDelay: `${120 + i * 80}ms` }}>
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-resolved/15 text-resolved"><Check size={14} strokeWidth={3} aria-hidden /></span>
                <span className="text-ink/75">{p}</span>
              </li>
            ))}
          </ul>
          <Link to={role.cta.to} className="btn btn-primary mt-7">{role.cta.text} <ArrowRight size={16} aria-hidden /></Link>
        </div>
        <div className="animate-pop rounded-[1.6rem] border border-ink/10 bg-surface p-4 shadow-lift [animation-delay:80ms]">
          <div className="mb-3 flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-ink/15" /><span className="size-2 rounded-full bg-ink/15" /><span className="size-2 rounded-full bg-ink/15" />
            <span className="ml-2 text-[11px] text-ink/45">{role.id === "citizen" ? "Report an issue" : role.id === "officer" ? "Field Desk" : "Command Center"}</span>
          </div>
          {createElement(SCREENS[role.id])}
        </div>
      </div>
    </div>
  );
}
