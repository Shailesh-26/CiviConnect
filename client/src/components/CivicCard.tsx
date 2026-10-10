import { useEffect, useRef, useState } from "react";
import { Award, BadgeCheck, Bird, Eye, Flag, Heart, Lock, Megaphone, MessageCircle, Repeat, Sparkles, type LucideIcon } from "lucide-react";
import { api } from "../lib/api";
import { confetti } from "../lib/confetti";
import { readSetting, writeSetting } from "../lib/storage";
import type { CivicScore } from "../types";
import { CountUp } from "./CountUp";

const BADGE_ICON: Record<string, LucideIcon> = {
  first_report: Flag,
  watch: Eye,
  fixer: BadgeCheck,
  verifier: Sparkles,
  voice: Megaphone,
  early_bird: Bird,
  chronic_hunter: Repeat,
  conversation: MessageCircle,
};

// Civic score, level and badges for citizens. Celebrates newly earned badges once.
export function CivicCard({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<CivicScore | null>(null);
  const celebrated = useRef(false);

  useEffect(() => {
    api<CivicScore>("/insights/civic").then(setData).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!data || celebrated.current) return;
    celebrated.current = true;
    const earned = data.badges.filter((b) => b.earned).map((b) => b.id).sort().join(",");
    const seen = readSetting("cc-badges");
    if (seen !== null && earned !== seen && earned.length > seen.length) confetti({ y: 0.3 });
    writeSetting("cc-badges", earned);
  }, [data]);

  if (!data) return <div className="skeleton h-56 !rounded-3xl" />;

  const span = data.nextLevel ? data.nextLevel.at - data.levelFloor : 1;
  const progress = data.nextLevel ? (data.score - data.levelFloor) / span : 1;
  const badges = compact ? data.badges.slice(0, 6) : data.badges;

  return (
    <section className="card spot overflow-hidden">
      <div className="relative bg-gradient-to-br from-signboard to-[#123456] p-5 text-white sm:p-6">
        <div className="grid-paper pointer-events-none absolute inset-0 opacity-20" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/60"><Heart size={14} aria-hidden /> Civic score</p>
            <p className="mt-1 font-display text-5xl font-bold"><CountUp value={data.score} /></p>
            <p className="mt-1 text-sm text-white/80">{data.level}</p>
          </div>
          <div className="min-w-48 flex-1 sm:max-w-xs">
            <div className="flex justify-between text-xs text-white/70">
              <span>{data.level}</span>
              <span>{data.nextLevel ? `${data.nextLevel.remaining} to ${data.nextLevel.name}` : "Top level"}</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-marker transition-all duration-1000" style={{ width: `${Math.max(4, progress * 100)}%` }} />
            </div>
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold"><Award size={17} className="text-marker-dark" aria-hidden /> Badges <span className="text-xs font-normal text-ink/50">{data.badges.filter((b) => b.earned).length} of {data.badges.length}</span></h3>
        <ul className={`mt-3 grid gap-2.5 ${compact ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-4"}`}>
          {badges.map((b) => {
            const Icon = BADGE_ICON[b.id] ?? Award;
            return (
              <li key={b.id} title={`${b.name}: ${b.description}`} className={`tilt flex flex-col items-center rounded-2xl border p-3 text-center transition ${b.earned ? "border-marker/50 bg-marker/10" : "border-ink/10 bg-ink/[0.03]"}`}>
                <span className={`relative grid size-11 place-items-center rounded-2xl ${b.earned ? "bg-marker text-[#241a00] shadow-card" : "bg-ink/8 text-ink/35"}`}>
                  <Icon size={20} aria-hidden />
                  {!b.earned && <Lock size={11} className="absolute -bottom-1 -right-1 rounded-full bg-surface p-0.5 text-ink/50" aria-hidden />}
                </span>
                <span className={`mt-2 text-xs font-semibold leading-tight ${b.earned ? "" : "text-ink/50"}`}>{b.name}</span>
                {!compact && <span className="mt-1 text-[10px] leading-tight text-ink/50">{b.description}</span>}
                {!b.earned && b.goal > 1 && (
                  <span className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ink/8"><span className="block h-full rounded-full bg-marker" style={{ width: `${(b.progress / b.goal) * 100}%` }} /></span>
                )}
              </li>
            );
          })}
        </ul>
        {!compact && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-ink/55">How your score adds up</p>
            <ul className="mt-2 divide-y divide-ink/8 text-sm">
              {data.breakdown.map((r) => (
                <li key={r.label} className="flex items-center gap-3 py-2">
                  <span className="flex-1">{r.label}</span>
                  <span className="text-xs text-ink/50">{r.detail}</span>
                  <span className="w-12 text-right font-semibold tabular-nums">{r.points}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-ink/45">Points reward useful civic actions (reports others confirm, fixes you verify), not volume alone.</p>
          </div>
        )}
      </div>
    </section>
  );
}
