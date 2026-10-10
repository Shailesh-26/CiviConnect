import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Camera, Layers, MapPinned, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { CategoryChip } from "../components/CategoryChip";
import { CountUp } from "../components/CountUp";
import { Logo } from "../components/Logo";
import { PublicMap } from "../components/PublicMap";
import { StatusBadge } from "../components/StatusBadge";
import { ThemeToggle } from "../components/ThemeToggle";
import { Skeleton } from "../components/ui";
import { api } from "../lib/api";
import { issueLabel } from "../lib/constants";
import { formatDuration, timeAgo } from "../lib/format";
import type { PublicOverview } from "../types";

const STEPS = [
  { icon: Camera, title: "Report it", text: "Pick the problem, drop a pin on the map, add a photo. It takes under a minute." },
  { icon: Layers, title: "It merges", text: "Someone already reported it within 50 m? Your report joins theirs and the priority score rises." },
  { icon: ShieldCheck, title: "Officer fixes it", text: "The right department is assigned. Every status change shows up on the public timeline." },
  { icon: BadgeCheck, title: "You verify", text: "Fixes need photo proof. If citizens say it is still broken, the issue reopens automatically." },
];

export default function Landing() {
  const { user } = useAuth();
  const [data, setData] = useState<PublicOverview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    api<PublicOverview>("/public/overview")
      .then((d) => active && setData(d))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  const stats = data?.stats;
  const rate = stats && stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-[2000] border-b border-ink/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-1.5">
            <a href="#how" className="btn btn-ghost hidden sm:inline-flex">How it works</a>
            <a href="#map" className="btn btn-ghost hidden sm:inline-flex">Live map</a>
            <ThemeToggle />
            {user ? (
              <Link to="/dashboard" className="btn btn-primary">Open dashboard <ArrowRight size={16} aria-hidden /></Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost">Log in</Link>
                <Link to="/register" className="btn btn-primary">Get started</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="grid-paper pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink/70">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-resolved" />
                <span className="relative inline-flex size-2 rounded-full bg-resolved" />
              </span>
              Live civic accountability for Indian cities
            </p>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.02] sm:text-6xl">
              Don&apos;t just complain.
              <br />
              <span className="text-accent">Watch it get fixed.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink/65">
              CiviConnect merges duplicate reports, ranks problems with a transparent priority score, and only closes an issue
              when the fix has photo proof and your neighbours agree.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={user ? "/report" : "/register"} className="btn btn-marker !px-6 !py-3.5 text-base">
                <MapPinned size={19} aria-hidden /> Report a problem
              </Link>
              <a href="#map" className="btn btn-outline !px-6 !py-3.5 text-base">See the live map</a>
            </div>
          </div>

          <div className="relative animate-rise [animation-delay:120ms]">
            <div className="card relative overflow-hidden p-3">
              {data ? <PublicMap pins={data.pins} className="h-[22rem] sm:h-[26rem]" /> : <Skeleton className="h-[22rem] w-full !rounded-2xl sm:h-[26rem]" />}
            </div>
            <div className="card absolute -bottom-5 left-4 flex animate-float items-center gap-3 px-4 py-3 sm:-left-6">
              <span className="grid size-10 place-items-center rounded-xl bg-resolved/15 text-resolved"><BadgeCheck size={20} aria-hidden /></span>
              <div>
                <p className="font-display text-xl font-bold leading-none">{stats ? <CountUp value={rate} suffix="%" /> : "–"}</p>
                <p className="mt-1 text-xs text-ink/60">issues resolved</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Reports received", value: stats?.reports, tone: "text-ink" },
            { label: "Issues open now", value: stats?.open, tone: "text-marker-dark" },
            { label: "Issues resolved", value: stats?.resolved, tone: "text-resolved" },
          ].map((tile) => (
            <div key={tile.label} className="card p-5">
              <div className={`font-display text-4xl font-bold ${tile.tone}`}>{tile.value === undefined ? <Skeleton className="h-10 w-20" /> : <CountUp value={tile.value} />}</div>
              <p className="mt-1.5 text-sm text-ink/60">{tile.label}</p>
            </div>
          ))}
          <div className="card p-5">
            <div className="font-display text-4xl font-bold text-accent">
              {stats ? formatDuration(stats.avgResolutionHours).replace(" hours", " h").replace(" days", " d") : <Skeleton className="h-10 w-24" />}
            </div>
            <p className="mt-1.5 text-sm text-ink/60">Average time to fix</p>
          </div>
        </div>
        {failed && <p className="mt-4 text-sm text-ink/55">Live numbers are unavailable right now. Start the server to see them.</p>}
      </section>

      <section id="how" className="reveal mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">How it works</p>
          <h2 className="mt-3 text-4xl font-semibold">Not a complaint box. A closed loop.</h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="card card-hover relative p-6">
              <span className="font-display text-5xl font-bold text-ink/8">{String(i + 1).padStart(2, "0")}</span>
              <span className="mt-2 grid size-11 place-items-center rounded-xl bg-accent/12 text-accent"><Icon size={22} aria-hidden /></span>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-ink/65">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="map" className="reveal mx-auto max-w-6xl scroll-mt-20 px-4 pb-24 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">Live map</p>
            <h2 className="mt-3 text-3xl font-semibold">Every pin is a real report.</h2>
            <div className="card mt-5 overflow-hidden p-3">
              {data ? <PublicMap pins={data.pins} className="h-[30rem]" /> : <Skeleton className="h-[30rem] w-full !rounded-2xl" />}
            </div>
            <p className="mt-3 flex items-center gap-4 text-xs text-ink/60">
              <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-[#c2561f]" /> Open</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-resolved" /> Resolved</span>
              <span>Scroll the page, tap a pin for details.</span>
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">Just now</p>
            <h2 className="mt-3 text-3xl font-semibold">Latest activity</h2>
            <ul className="mt-5 space-y-2.5">
              {data
                ? data.activity.map((a, i) => (
                    <li key={`${a.ticket}-${i}`} className="card flex items-center gap-3 p-3">
                      <CategoryChip category={a.category} icon={a.customIcon} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{issueLabel(a)}</p>
                        <p className="truncate text-xs text-ink/55">{a.address ?? a.ticket} · {timeAgo(a.at)}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </li>
                  ))
                : Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 w-full !rounded-2xl" />)}
              {data && data.activity.length === 0 && <li className="text-sm text-ink/55">No activity yet. Be the first to report.</li>}
            </ul>
          </div>
        </div>
      </section>

      <section className="reveal mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-signboard px-6 py-14 text-center text-white sm:px-12">
          <div className="grid-paper pointer-events-none absolute inset-0 opacity-25" aria-hidden />
          <Sparkles size={28} className="relative mx-auto text-marker" aria-hidden />
          <h2 className="relative mx-auto mt-4 max-w-xl text-4xl font-semibold">Your street will not fix itself.</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-white/75">Create a free account, report the first problem you see, and follow it until it is gone.</p>
          <Link to={user ? "/report" : "/register"} className="btn btn-marker relative mt-8 !px-7 !py-3.5 text-base">
            {user ? "Report a problem" : "Create free account"} <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink/10 py-8 text-center text-xs text-ink/50">
        CiviConnect · Crowdsourced civic issue reporting and resolution · Map data © OpenStreetMap contributors
      </footer>
    </div>
  );
}
