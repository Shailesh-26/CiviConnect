import { Link } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { LogoMark } from "../Logo";
import { ThemeToggle } from "../ThemeToggle";

const COLUMNS: { title: string; links: { label: string; href: string; route?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how" },
      { label: "Live city", href: "#live" },
      { label: "Under the hood", href: "#stack" },
    ],
  },
  {
    title: "For",
    links: [
      { label: "Citizens", href: "#roles" },
      { label: "Field officers", href: "#roles" },
      { label: "City admins", href: "#roles" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Create account", href: "/register", route: true },
      { label: "Log in", href: "/login", route: true },
      { label: "Report a problem", href: "/report", route: true },
      { label: "Neighbourhood", href: "/neighbourhood", route: true },
    ],
  },
];

export function LandingFooter({ live }: { live: boolean }) {
  return (
    <footer className="relative mt-10 overflow-hidden border-t border-ink/10 bg-surface/60 backdrop-blur">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-10 pt-16 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display text-xl font-bold tracking-tight">Civi<span className="text-accent">Connect</span></span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-ink/60">Crowdsourced civic issue reporting and resolution. Report it, watch it get fixed, confirm it's gone.</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-surface px-3 py-1.5 text-xs font-medium">
            <span className="relative flex size-2">
              {live && <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-resolved" />}
              <span className={`relative inline-flex size-2 rounded-full ${live ? "bg-resolved" : "bg-ink/30"}`} />
            </span>
            {live ? "All systems live" : "Server offline"}
          </div>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink/45">{col.title}</p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.route ? (
                    <Link to={l.href} className="cc-link text-sm text-ink/70 hover:text-ink">{l.label}</Link>
                  ) : (
                    <a href={l.href} className="cc-link text-sm text-ink/70 hover:text-ink">{l.label}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 border-t border-ink/10 px-4 py-6 text-xs text-ink/50 sm:px-6">
        <span>© {new Date().getFullYear()} CiviConnect · Mini project</span>
        <span>Map data © <a href="https://www.openstreetmap.org/copyright" className="underline-offset-2 hover:underline" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors</span>
        <span className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <a href="#top" className="btn btn-ghost size-10 !p-0" aria-label="Back to top"><ArrowUp size={18} aria-hidden /></a>
        </span>
      </div>

      <p className="cc-wordmark pointer-events-none select-none text-center font-display font-bold leading-[0.8] tracking-tighter" aria-hidden>CiviConnect</p>
    </footer>
  );
}
