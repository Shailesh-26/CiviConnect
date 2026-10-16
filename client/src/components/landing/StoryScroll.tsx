import { useEffect, useState } from "react";
import { BadgeCheck, Camera, Layers, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import { CATEGORY_COLOR } from "../../lib/constants";
import { RoadArt } from "./RoadArt";

const STEPS = [
  { icon: Camera, title: "Report it", text: "Snap a photo, pick the problem and drop a pin. Your phone's location fills itself in. Under a minute, start to finish." },
  { icon: Layers, title: "It merges and ranks", text: "Already reported within 50 m? Your report joins that issue, and its priority score climbs, so the worst problems rise to the top." },
  { icon: ShieldCheck, title: "The right officer fixes it", text: "Routing suggests the officer by department, past work and current load. The fix-by clock starts ticking and every status change is public." },
  { icon: BadgeCheck, title: "You confirm it's gone", text: "The fix needs a proof photo. Reporters and neighbours vote. If it's still broken, the issue reopens on its own with a tighter deadline." },
];

function Visual({ step }: { step: number }) {
  if (step === 0)
    return (
      <div className="relative h-full overflow-hidden rounded-2xl bg-ink/[0.04]">
        <div className="grid-paper absolute inset-0" aria-hidden />
        <svg viewBox="0 0 200 160" className="absolute inset-0 h-full w-full" aria-hidden>
          <path d="M0 110 C60 100 80 60 200 70M90 0v160M0 40h200" stroke="currentColor" strokeOpacity=".12" strokeWidth="10" fill="none" />
        </svg>
        <div className="cc-pin-drop absolute left-1/2 top-[42%]">
          <svg width="44" height="54" viewBox="0 0 44 54" aria-hidden><path d="M22 2C11 2 3 10 3 20c0 14 19 31 19 31s19-17 19-31C41 10 33 2 22 2z" fill={CATEGORY_COLOR.pothole} stroke="#fff" strokeWidth="3" /><circle cx="22" cy="20" r="7" fill="#fff" /></svg>
        </div>
        <span className="cc-ripple absolute left-1/2 top-[42%] size-10 rounded-full border-2" style={{ borderColor: CATEGORY_COLOR.pothole }} />
        <div className="cc-row-in absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-lift [animation-delay:.5s]">
          <RoadArt className="h-12 w-16 shrink-0 rounded-lg" />
          <div className="min-w-0 text-sm"><p className="font-semibold">Pothole near the bus stop</p><p className="text-xs text-ink/55">17.4374° N, 78.4482° E · photo attached</p></div>
        </div>
      </div>
    );
  if (step === 1)
    return (
      <div className="relative grid h-full place-items-center overflow-hidden rounded-2xl bg-ink/[0.04]">
        <div className="grid-paper absolute inset-0" aria-hidden />
        <div className="relative w-64 space-y-2">
          {[38, 44, 50, 61].map((score, i) => (
            <div key={score} className="cc-row-in flex items-center gap-3 rounded-xl bg-surface p-2.5 shadow-card" style={{ animationDelay: `${i * 350}ms` }}>
              <span className="grid size-7 place-items-center rounded-full bg-accent/12 text-xs font-bold text-accent">{i + 1}</span>
              <span className="flex-1 text-xs font-medium">{i === 0 ? "First report" : `+1 report merged`}</span>
              <span className="font-display text-sm font-bold tabular-nums">{score}</span>
            </div>
          ))}
        </div>
      </div>
    );
  if (step === 2)
    return (
      <div className="relative grid h-full place-items-center overflow-hidden rounded-2xl bg-signboard p-6 text-white">
        <div className="grid-paper absolute inset-0 opacity-25" aria-hidden />
        <div className="relative w-full max-w-xs space-y-3">
          {[
            ["Ravi Kumar", "Roads · 2 open", 92],
            ["Kiran Joshi", "Roads · 7 open", 64],
            ["Sana Fatima", "Sanitation · 3 open", 21],
          ].map(([n, d, m], i) => (
            <div key={n as string} className={`cc-row-in rounded-xl p-3 ${i === 0 ? "bg-white text-[#17202b] shadow-lift" : "bg-white/10"}`} style={{ animationDelay: `${i * 150}ms` }}>
              <div className="flex items-center justify-between text-sm"><span className="font-semibold">{n}</span><span className="text-xs opacity-60">{d}</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-current/15">
                <div className="cc-grow h-full origin-left rounded-full bg-marker" style={{ "--to": (m as number) / 100, animationDelay: `${300 + i * 150}ms` } as React.CSSProperties} />
              </div>
              {i === 0 && <p className="mt-1.5 text-[11px] font-semibold text-resolved">Suggested · best match</p>}
            </div>
          ))}
        </div>
      </div>
    );
  return (
    <div className="relative h-full overflow-hidden rounded-2xl">
      <RoadArt fixed className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-surface p-4 shadow-lift cc-row-in">
        <p className="text-sm font-semibold">Is it really fixed?</p>
        <div className="mt-3 space-y-2 text-xs">
          <div className="flex items-center gap-2"><ThumbsUp size={14} className="text-resolved" aria-hidden /><div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/8"><div className="cc-grow h-full origin-left rounded-full bg-resolved" style={{ "--to": 0.85 } as React.CSSProperties} /></div><span className="w-6 font-semibold">11</span></div>
          <div className="flex items-center gap-2"><ThumbsDown size={14} className="text-alert" aria-hidden /><div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/8"><div className="cc-grow h-full origin-left rounded-full bg-alert" style={{ "--to": 0.08 } as React.CSSProperties} /></div><span className="w-6 font-semibold">1</span></div>
        </div>
      </div>
    </div>
  );
}

// Scroll-driven story: the step in the middle of the screen lights up and the sticky picture follows it.
export function StoryScroll() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-story]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.story));
      },
      { rootMargin: "-48% 0px -48% 0px" },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <ol className="relative">
        <span className="absolute bottom-6 left-[1.35rem] top-6 w-0.5 rounded-full bg-ink/10" aria-hidden />
        <span className="absolute left-[1.35rem] top-6 w-0.5 origin-top rounded-full bg-accent transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)]" style={{ height: "calc(100% - 3rem)", transform: `scaleY(${active / (STEPS.length - 1)})` }} aria-hidden />
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} data-story={i} className="relative flex gap-5 py-6 lg:min-h-[44vh] lg:items-center">
            <span className={`relative z-10 grid size-11 shrink-0 place-items-center rounded-full border-2 transition-all duration-500 ${i <= active ? "border-accent bg-accent text-white shadow-lift" : "border-ink/15 bg-paper text-ink/40"} ${i === active ? "scale-110" : ""}`}>
              <Icon size={19} aria-hidden />
            </span>
            <div className={`transition-all duration-500 ${i === active ? "opacity-100" : "lg:opacity-40"}`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">Step {i + 1}</p>
              <h3 className="mt-1 text-2xl font-semibold sm:text-3xl">{title}</h3>
              <p className="mt-2 max-w-md text-ink/65">{text}</p>
              <div className="mt-5 h-64 lg:hidden"><Visual step={i} /></div>
            </div>
          </li>
        ))}
      </ol>
      <div className="hidden lg:block">
        <div className="sticky top-28 h-[26rem] rounded-[1.8rem] border border-ink/10 bg-surface p-3 shadow-lift">
          <div key={active} className="h-full animate-page">
            <Visual step={active} />
          </div>
          <div className="absolute -bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full border border-ink/10 bg-surface px-3 py-2 shadow-card">
            {STEPS.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === active ? "w-6 bg-accent" : "w-1.5 bg-ink/20"}`} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
