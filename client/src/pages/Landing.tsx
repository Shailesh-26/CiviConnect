import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Clock3, Cpu, Database, FileClock, Globe2, MapPinned, Radio, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { CategoryChip } from "../components/CategoryChip";
import { CategoryIcon } from "../components/CategoryIcon";
import { CountUp } from "../components/CountUp";
import { StatusBadge } from "../components/StatusBadge";
import { Skeleton } from "../components/ui";
import { Faq } from "../components/landing/Faq";
import { FeatureBento } from "../components/landing/FeatureBento";
import { HeroPreview } from "../components/landing/HeroPreview";
import { LandingFooter } from "../components/landing/LandingFooter";
import { LandingHeader } from "../components/landing/LandingHeader";
import { RoleTabs } from "../components/landing/RoleTabs";
import { StoryScroll } from "../components/landing/StoryScroll";
import { api } from "../lib/api";
import { CATEGORY_COLOR, categoryMeta, issueLabel } from "../lib/constants";
import { formatDuration, timeAgo } from "../lib/format";
import { useInView, useInterval } from "../lib/useInView";
import type { Category, PublicOverview } from "../types";

// The map library is only downloaded when the visitor scrolls near the live map.
const PublicMap = lazy(() => import("../components/PublicMap").then((m) => ({ default: m.PublicMap })));

const WORDS: { word: string; category: Category }[] = [
  { word: "pothole", category: "pothole" },
  { word: "blocked drain", category: "drainage" },
  { word: "garbage pile", category: "garbage" },
  { word: "fallen tree", category: "fallen_tree" },
  { word: "dark streetlight", category: "streetlight" },
];

const STACK = [
  { icon: Globe2, title: "Geospatial core", text: "MongoDB 2dsphere index powers 50 m merging, the 2 km feed and chronic-spot detection." },
  { icon: Radio, title: "Server-Sent Events", text: "One open stream per user pushes notifications and refreshes screens live." },
  { icon: Clock3, title: "SLA engine", text: "A sweep every minute backfills deadlines, warns officers and escalates overdue work." },
  { icon: FileClock, title: "Audit trail", text: "Every assignment, status change and moderation action is logged with who and when." },
];

const TECH = ["React 19", "TypeScript", "Vite", "Tailwind CSS", "Express 5", "MongoDB Atlas", "Mongoose", "Zod", "Leaflet", "OpenStreetMap", "Cloudinary", "Recharts"];

function Section({ id, kicker, title, text, children, className = "" }: { id: string; kicker: string; title: string; text?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28 ${className}`}>
      <div className="reveal mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">{kicker}</p>
        <h2 className="mt-3 text-4xl font-semibold sm:text-5xl">{title}</h2>
        {text && <p className="mt-4 text-lg text-ink/60">{text}</p>}
      </div>
      <div className="mt-12 sm:mt-16">{children}</div>
    </section>
  );
}

function StatTile({ label, value, tone, suffix = "", text }: { label: string; value?: number; tone: string; suffix?: string; text?: string }) {
  const [ref, inView] = useInView({ once: true, threshold: 0.4 });
  return (
    <div ref={ref} className="card card-hover tilt p-5 sm:p-6">
      <div className={`font-display text-4xl font-bold sm:text-5xl ${tone}`}>
        {text !== undefined ? text : value === undefined ? <Skeleton className="h-11 w-24" /> : <CountUp value={inView ? value : 0} suffix={suffix} />}
      </div>
      <p className="mt-2 text-sm text-ink/60">{label}</p>
    </div>
  );
}

function WordRotator() {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const [i, setI] = useState(0);
  useInterval(() => setI((v) => (v + 1) % WORDS.length), 2400, inView);
  const w = WORDS[i];
  return (
    <span ref={ref} className="relative inline-flex items-center gap-3 whitespace-nowrap align-bottom" style={{ color: CATEGORY_COLOR[w.category] }}>
      <span key={`i${i}`} className="cc-word hidden size-[0.85em] sm:grid place-items-center rounded-[0.22em] text-[0.6em]" style={{ background: `${CATEGORY_COLOR[w.category]}22` }}>
        <CategoryIcon category={w.category} size={36} />
      </span>
      <span key={i} className="cc-word inline-block">{w.word}.</span>
    </span>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const [data, setData] = useState<PublicOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [mapRef, mapVisible] = useInView({ once: true, rootMargin: "300px" });
  const [liveRef, liveInView] = useInView<HTMLElement>({ threshold: 0.1 });

  const load = useCallback(() => {
    api<PublicOverview>("/public/overview")
      .then((d) => {
        setData(d);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  // Keep the numbers and the activity feed fresh while the live section is on screen.
  useInterval(load, 30_000, liveInView);

  // Pointer parallax for the hero: CSS variables only, so it never re-renders React.
  const onHeroMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    e.currentTarget.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    e.currentTarget.style.setProperty("--gx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--gy", `${e.clientY - r.top}px`);
  };
  const onHeroLeave = (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty("--px", "0");
    e.currentTarget.style.setProperty("--py", "0");
  };

  // Magnetic call-to-action button.
  const onMagnet = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--bx", `${((e.clientX - r.left) / r.width - 0.5) * 18}px`);
    e.currentTarget.style.setProperty("--by", `${((e.clientY - r.top) / r.height - 0.5) * 14}px`);
  };
  const offMagnet = (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty("--bx", "0px");
    e.currentTarget.style.setProperty("--by", "0px");
  };

  const stats = data?.stats;
  const rate = stats && stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : undefined;
  const maxCat = stats ? Math.max(1, ...stats.byCategory.map((c) => c.count)) : 1;
  const ticker = data?.activity ?? [];

  return (
    <div id="top" className="min-h-screen overflow-x-clip">
      <LandingHeader />

      {/* Hero */}
      <section onPointerMove={onHeroMove} onPointerLeave={onHeroLeave} className="cc-hero relative">
        <div className="grid-paper pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]" aria-hidden />
        <div className="cc-glow pointer-events-none absolute left-0 top-0 hidden md:block" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-32 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-32 lg:pt-40">
          <div>
            <p className="animate-rise inline-flex items-center gap-2 rounded-full border border-ink/12 bg-surface/80 px-3.5 py-1.5 text-xs font-semibold text-ink/70 backdrop-blur">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-resolved" />
                <span className="relative inline-flex size-2 rounded-full bg-resolved" />
              </span>
              Civic accountability, live for Indian cities
            </p>
            <h1 className="mt-6 text-[2.3rem] font-semibold leading-[1.05] sm:text-6xl lg:text-[3.85rem]">
              <span className="animate-rise block [animation-delay:60ms]">Report the</span>
              <span className="animate-rise block min-h-[1.1em] [animation-delay:120ms]"><WordRotator /></span>
              <span className="animate-rise block [animation-delay:180ms]">
                Watch it get <span className="whitespace-nowrap"><span className="cc-marker relative inline-block">fixed</span>.</span>
              </span>
            </h1>
            <p className="animate-rise mt-6 max-w-xl text-lg text-ink/65 [animation-delay:260ms]">
              CiviConnect merges duplicate reports, ranks problems with a priority score anyone can read, puts every fix on a clock, and only closes an issue when there's photo proof and your neighbours agree.
            </p>
            <div className="animate-rise mt-8 flex flex-wrap gap-3 [animation-delay:340ms]">
              <Link to={user ? "/report" : "/register"} className="btn btn-marker !px-6 !py-3.5 text-base">
                <MapPinned size={19} aria-hidden /> Report a problem
              </Link>
              <a href="#how" className="btn btn-outline group !px-6 !py-3.5 text-base">
                See how it works <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" aria-hidden />
              </a>
            </div>
            <dl className="animate-rise mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm [animation-delay:420ms]">
              {[
                [stats ? <CountUp key="r" value={stats.reports} /> : "–", "reports received"],
                [rate !== undefined ? <CountUp key="p" value={rate} suffix="%" /> : "–", "already resolved"],
                [stats ? formatDuration(stats.avgResolutionHours).replace(" hours", " h").replace(" days", " days") : "–", "average fix time"],
              ].map(([v, l], k) => (
                <div key={k}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="font-display text-2xl font-bold">{v}</dd>
                  <dd className="text-ink/55">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="animate-rise relative [animation-delay:200ms] lg:pl-4">
            <HeroPreview />
          </div>
        </div>
      </section>

      {/* Live ticker */}
      {ticker.length > 0 && (
        <div className="cc-marquee-wrap cc-fade-x border-y border-ink/10 bg-surface/60 py-3 backdrop-blur">
          <div className="cc-marquee" style={{ "--dur": `${Math.max(30, ticker.length * 6)}s` } as React.CSSProperties}>
            {[0, 1].map((copy) => (
              <ul key={copy} className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={copy === 1}>
                {ticker.map((a, i) => (
                  <li key={`${a.ticket}-${i}`} className="flex items-center gap-2.5 whitespace-nowrap rounded-full border border-ink/10 bg-surface px-3 py-1.5 text-sm">
                    <span className="grid size-6 place-items-center rounded-full" style={{ background: `${CATEGORY_COLOR[a.category]}22`, color: CATEGORY_COLOR[a.category] }}><CategoryIcon category={a.category} icon={a.customIcon} size={13} /></span>
                    <span className="font-medium">{issueLabel(a)}</span>
                    <span className="text-ink/45">{a.address ?? a.ticket}</span>
                    <StatusBadge status={a.status} />
                    <span className="text-xs text-ink/45">{timeAgo(a.at)}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      <Section id="features" kicker="Features" title="Not a complaint box. A closed loop." text="Everything a city needs to go from “someone posted about it” to “it's fixed and people agree”. Try the pieces below, they're live.">
        <FeatureBento />
      </Section>

      {/* Roles */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-10 bottom-10 -skew-y-2 bg-gradient-to-b from-transparent via-accent/[0.05] to-transparent" aria-hidden />
        <Section id="roles" kicker="Who it's for" title="One platform, three desks." text="Each role gets a workspace built for what they actually do all day.">
          <div className="reveal"><RoleTabs /></div>
        </Section>
      </div>

      {/* How it works */}
      <Section id="how" kicker="How it works" title="From photo to fixed, in four steps.">
        <StoryScroll />
      </Section>

      {/* Live city */}
      <section id="live" ref={liveRef} className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
        <div className="reveal flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-accent">
              <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-alert" /><span className="relative inline-flex size-2 rounded-full bg-alert" /></span>
              Live city
            </p>
            <h2 className="mt-3 text-4xl font-semibold sm:text-5xl">Every pin is a real report.</h2>
            <p className="mt-3 text-lg text-ink/60">Numbers refresh on their own while you're here. No names, no photos, just the problems and how they're going.</p>
          </div>
          {user ? (
            <Link to="/map" className="btn btn-outline">Open the full map <ArrowRight size={16} aria-hidden /></Link>
          ) : (
            <Link to="/register" className="btn btn-outline">Join to explore <ArrowRight size={16} aria-hidden /></Link>
          )}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Reports received" value={stats?.reports} tone="text-ink" />
          <StatTile label="Open right now" value={stats?.open} tone="text-marker-dark" />
          <StatTile label="Resolved" value={stats?.resolved} tone="text-resolved" />
          <StatTile label="Average time to fix" tone="text-accent" text={stats ? formatDuration(stats.avgResolutionHours).replace(" hours", " h").replace(" days", " d") : undefined} />
        </div>
        {failed && <p className="mt-4 text-sm text-ink/55">Live numbers are unavailable right now. Start the server to see them.</p>}

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div ref={mapRef} id="live-map" className="reveal card scroll-mt-28 overflow-hidden p-2.5">
            {data && mapVisible ? (
              <Suspense fallback={<Skeleton className="h-[28rem] w-full !rounded-2xl" />}><PublicMap pins={data.pins} className="h-[28rem]" /></Suspense>
            ) : (
              <Skeleton className="h-[28rem] w-full !rounded-2xl" />
            )}
            <p className="flex flex-wrap items-center gap-4 px-2 pb-1 pt-3 text-xs text-ink/60">
              <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-[#c2561f]" /> Open</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-resolved" /> Resolved</span>
              <span>Tap a pin for details.</span>
            </p>
          </div>

          <div className="grid gap-4">
            <div className="reveal card p-5">
              <p className="font-display text-base font-semibold">What people report</p>
              <ul className="mt-3 space-y-2.5">
                {(stats?.byCategory ?? []).map((c, i) => (
                  <li key={c.category} className="group flex items-center gap-3 text-sm">
                    <span className="grid size-7 place-items-center rounded-lg transition-transform group-hover:scale-110" style={{ background: `${CATEGORY_COLOR[c.category]}22`, color: CATEGORY_COLOR[c.category] }}><CategoryIcon category={c.category} size={15} /></span>
                    <span className="w-24 truncate text-ink/70">{categoryMeta(c.category).label}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/7">
                      <span className="block h-full origin-left rounded-full transition-transform duration-1000 ease-[cubic-bezier(.22,1,.36,1)]" style={{ background: CATEGORY_COLOR[c.category], transform: `scaleX(${liveInView ? c.count / maxCat : 0})`, transitionDelay: `${i * 90}ms` }} />
                    </span>
                    <span className="w-8 text-right font-semibold tabular-nums">{c.count}</span>
                  </li>
                ))}
                {!stats && Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-7 w-full" />)}
              </ul>
            </div>
            <div id="live-feed" className="reveal card scroll-mt-28 p-5">
              <p className="flex items-center justify-between font-display text-base font-semibold">Just now <span className="text-xs font-normal text-ink/45">auto-updating</span></p>
              <ul className="mt-3 space-y-2">
                {(data?.activity ?? []).slice(0, 5).map((a, i) => (
                  <li key={`${a.ticket}-${a.at}`} className="cc-row-in flex items-center gap-3" style={{ animationDelay: `${i * 60}ms` }}>
                    <CategoryChip category={a.category} icon={a.customIcon} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{issueLabel(a)}</p>
                      <p className="truncate text-xs text-ink/55">{a.address ?? a.ticket} · {timeAgo(a.at)}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
                {data && data.activity.length === 0 && <li className="text-sm text-ink/55">No activity yet. Be the first to report.</li>}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Under the hood */}
      <Section id="stack" kicker="Under the hood" title="Built like real city software." text="Not a form and a table. A proper backend with geospatial queries, live streams and a scheduler.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STACK.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="reveal card card-hover p-6" style={{ "--rd": `${i * 70}ms` } as React.CSSProperties}>
              <span className="grid size-11 place-items-center rounded-xl bg-signboard text-white"><Icon size={20} aria-hidden /></span>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-ink/60">{text}</p>
            </div>
          ))}
        </div>
        <div className="reveal mt-10 flex flex-wrap items-center justify-center gap-2">
          <span className="mr-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-ink/45"><Cpu size={14} aria-hidden /> Stack</span>
          {TECH.map((t) => (
            <span key={t} className="rounded-full border border-ink/10 bg-surface px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:-translate-y-0.5 hover:border-accent/40 hover:text-accent">{t}</span>
          ))}
          <span className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-surface px-3 py-1.5 text-xs font-medium text-ink/70"><Database size={12} aria-hidden /> <Workflow size={12} aria-hidden /> REST + SSE</span>
        </div>
      </Section>

      {/* FAQ */}
      <section id="faq" className="mx-auto grid max-w-6xl scroll-mt-24 gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1fr_1.6fr]">
        <div className="reveal">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">FAQ</p>
          <h2 className="mt-3 text-4xl font-semibold sm:text-5xl">Questions people ask.</h2>
          <p className="mt-4 text-ink/60">Straight answers about how reports are handled, ranked and closed.</p>
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-4">
            <ShieldCheck size={22} className="shrink-0 text-resolved" aria-hidden />
            <p className="text-sm text-ink/65">Public pages never show who reported a problem.</p>
          </div>
        </div>
        <div className="reveal"><Faq /></div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <div onPointerMove={onMagnet} onPointerLeave={offMagnet} className="reveal relative overflow-hidden rounded-[2rem] bg-signboard px-6 py-16 text-center text-white sm:px-12 sm:py-20">
          <div className="grid-paper pointer-events-none absolute inset-0 opacity-25" aria-hidden />
          <div className="cc-cta-pins pointer-events-none absolute inset-0" aria-hidden>
            {[[12, 30], [84, 24], [22, 78], [76, 72], [50, 14], [92, 56], [6, 58]].map(([x, y], i) => (
              <span key={i} className="absolute size-3 rounded-full bg-marker" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.6}s` }} />
            ))}
          </div>
          <Sparkles size={28} className="relative mx-auto text-marker" aria-hidden />
          <h2 className="relative mx-auto mt-4 max-w-2xl text-4xl font-semibold sm:text-5xl">Your street won't fix itself.</h2>
          <p className="relative mx-auto mt-4 max-w-lg text-white/75">Create a free account, report the first problem you see, and follow it until it's gone.</p>
          <div className="relative mt-9 flex flex-wrap justify-center gap-3">
            <Link to={user ? "/report" : "/register"} className="cc-magnet btn btn-marker !px-7 !py-4 text-base">
              {user ? "Report a problem" : "Create free account"} <ArrowRight size={18} aria-hidden />
            </Link>
            {!user && <Link to="/login" className="btn bg-white/10 !px-7 !py-4 text-base text-white hover:bg-white/20"><BadgeCheck size={18} aria-hidden /> I have an account</Link>}
          </div>
        </div>
      </section>

      <LandingFooter live={!!data && !failed} />
    </div>
  );
}
