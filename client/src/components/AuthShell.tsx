import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Camera, Layers, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { issueLabel, STATUS_META } from "../lib/constants";
import { timeAgo } from "../lib/format";
import type { PublicOverview } from "../types";
import { CategoryChip } from "./CategoryChip";
import { CityBackdrop } from "./CityBackdrop";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const points = [
  { icon: Camera, text: "Photo and a pin" },
  { icon: Layers, text: "Nearby reports merge" },
  { icon: ShieldCheck, text: "Proof before it closes" },
];

const VERB: Record<string, string> = {
  reported: "reported",
  acknowledged: "picked up",
  in_progress: "being fixed",
  resolved: "fixed",
  rejected: "closed",
};

// Real, anonymous activity from the city, cycling under the card.
function LiveTicker() {
  const [items, setItems] = useState<PublicOverview["activity"]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let active = true;
    api<PublicOverview>("/public/overview")
      .then((data) => active && setItems(data.activity))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % items.length), 4000);
    return () => window.clearInterval(timer);
  }, [items.length]);

  const item = items[index];
  if (!item) return null;

  return (
    <div className="mx-auto mt-5 flex w-full max-w-md items-center gap-3 rounded-2xl border border-ink/10 bg-surface/75 px-3 py-2.5 shadow-card backdrop-blur-xl" aria-live="polite">
      <span className="relative flex size-2.5 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-resolved opacity-70" />
        <span className="relative inline-flex size-2.5 rounded-full bg-resolved" />
      </span>
      <div key={`${item.ticket}-${index}`} className="flex min-w-0 flex-1 items-center gap-2.5 animate-fade">
        <CategoryChip category={item.category} icon={item.customIcon} size="sm" />
        <p className="min-w-0 flex-1 truncate text-xs text-ink/70">
          <span className="font-semibold text-ink">{issueLabel(item)}</span>{" "}
          <span style={{ color: STATUS_META[item.status].hex }} className="font-medium">{VERB[item.status]}</span>
          {item.address ? ` · ${item.address}` : ""}
        </p>
        <span className="shrink-0 text-[11px] text-ink/50">{timeAgo(item.at)}</span>
      </div>
    </div>
  );
}

// Full-screen auth layout: a living city map fills the screen and one glass card floats on top.
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-paper">
      <CityBackdrop />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 50% 50%, color-mix(in srgb, var(--c-paper) 88%, transparent) 0%, color-mix(in srgb, var(--c-paper) 35%, transparent) 60%, transparent 100%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 flex min-h-screen flex-col px-4 py-4 sm:px-8 sm:py-6">
        <header className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-1 rounded-2xl border border-ink/10 bg-surface/70 p-1 backdrop-blur">
            <Link to="/" className="btn btn-ghost !px-3 !py-2 text-sm">
              <ArrowLeft size={16} aria-hidden /> Home
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center py-8">
          <div className="mx-auto w-full max-w-md animate-pop rounded-3xl border border-ink/10 bg-surface/85 p-6 shadow-lift backdrop-blur-xl sm:p-8">
            <h1 className="text-3xl font-semibold">{title}</h1>
            <p className="mt-2 text-sm text-ink/60">{subtitle}</p>
            {children}
          </div>
          <LiveTicker />
        </main>

        <footer className="mx-auto flex flex-wrap justify-center gap-x-5 gap-y-2 pb-2 text-xs text-ink/60">
          {points.map(({ icon: Icon, text }) => (
            <span key={text} className="inline-flex items-center gap-1.5">
              <Icon size={14} className="text-marker-dark" aria-hidden /> {text}
            </span>
          ))}
        </footer>
      </div>
    </div>
  );
}
