import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CornerDownLeft,
  FilePlus2,
  Film,
  Award,
  LayoutDashboard,
  ListChecks,
  Map as MapIcon,
  Moon,
  Radar,
  Radio,
  Search,
  ShieldUser,
  Sun,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { api } from "../lib/api";
import { issueLabel } from "../lib/constants";
import { useTheme } from "../theme/theme-context";
import type { Issue, Role } from "../types";
import { CategoryChip } from "./CategoryChip";
import { StatusBadge } from "./StatusBadge";

type Action = { id: string; label: string; hint?: string; icon: LucideIcon; run: () => void; roles?: Role[] };

// Ctrl+K (or Cmd+K): jump anywhere or find any ticket without leaving the keyboard.
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const [found, setFound] = useState<Issue[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const go = (to: string) => () => {
    navigate(to);
    onClose();
  };

  const actions: Action[] = useMemo(
    () => [
      { id: "home", label: user?.role === "officer" ? "Field Desk" : user?.role === "admin" ? "Command Center" : "Dashboard", icon: user?.role === "officer" ? BriefcaseBusiness : user?.role === "admin" ? Radio : LayoutDashboard, run: go("/dashboard") },
      { id: "report", label: user?.role === "officer" ? "Log a field inspection" : user?.role === "admin" ? "Register a complaint" : "Report an issue", icon: FilePlus2, run: go("/report") },
      { id: "nearby", label: "Neighbourhood", hint: "Problems around you", icon: Radar, run: go("/neighbourhood") },
      { id: "mine", label: "My reports", icon: ListChecks, run: go("/my-reports"), roles: ["citizen"] },
      { id: "queue", label: user?.role === "officer" ? "My queue" : "All issues", icon: ListChecks, run: go("/issues"), roles: ["officer", "admin"] },
      { id: "map", label: "Explore the map", icon: MapIcon, run: go("/map") },
      { id: "insights", label: "Area report cards", hint: "Grades, chronic spots", icon: Award, run: go("/insights") },
      { id: "replay", label: "City time-lapse", icon: Film, run: go("/insights?tab=replay") },
      { id: "analytics", label: "Analytics", icon: BarChart3, run: go("/analytics"), roles: ["officer", "admin"] },
      { id: "admin", label: "Admin console", icon: ShieldUser, run: go("/admin"), roles: ["admin"] },
      { id: "profile", label: "Your profile", icon: UserRound, run: go("/profile") },
      { id: "theme", label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode", icon: theme === "dark" ? Sun : Moon, run: () => { toggle(); onClose(); } },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.role, theme],
  );

  const shown = actions.filter((a) => (!a.roles || (user && a.roles.includes(user.role))) && `${a.label} ${a.hint ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));

  // Ticket and place search on the server, after a short pause in typing.
  useEffect(() => {
    if (!open || q.trim().length < 2) return;
    let active = true;
    const t = window.setTimeout(async () => {
      const path = user?.role === "citizen" ? "/issues/mine" : user?.role === "officer" ? "/issues/assigned" : "/issues";
      try {
        const data = await api<{ issues: Issue[] }>(`${path}?page=1&limit=6&q=${encodeURIComponent(q.trim())}`);
        if (active) setFound(data.issues);
      } catch {
        if (active) setFound([]);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [q, open, user?.role]);

  const results = q.trim().length >= 2 ? found : [];
  const total = shown.length + results.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => (i + 1) % Math.max(1, total));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => (i - 1 + Math.max(1, total)) % Math.max(1, total));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (index < shown.length) shown[index]?.run();
        else {
          const issue = results[index - shown.length];
          if (issue) go(`/issues/${issue.id}`)();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2800] grid place-items-start justify-center px-3 pt-[12vh]">
      <div className="absolute inset-0 bg-ink/35 backdrop-blur-sm animate-fade" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-ink/10 bg-surface/90 shadow-lift backdrop-blur-2xl animate-pop">
        <div className="flex items-center gap-3 border-b border-ink/10 px-4">
          <Search size={18} className="text-ink/45" aria-hidden />
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIndex(0);
            }}
            placeholder="Go to a page or search a ticket, place or problem…"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-ink/40 focus-visible:outline-none"
          />
          <kbd className="rounded-md border border-ink/15 px-1.5 py-0.5 text-[11px] text-ink/50">Esc</kbd>
        </div>
        <div className="cc-scroll max-h-[55vh] overflow-y-auto p-2">
          {shown.length > 0 && <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink/45">Go to</p>}
          {shown.map((a, i) => (
            <button key={a.id} type="button" onMouseEnter={() => setIndex(i)} onClick={a.run} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${index === i ? "bg-accent/12 text-accent" : "text-ink/80"}`}>
              <a.icon size={18} aria-hidden />
              <span className="flex-1 font-medium">{a.label}</span>
              {a.hint && <span className="text-xs text-ink/45">{a.hint}</span>}
              {index === i && <CornerDownLeft size={14} aria-hidden />}
            </button>
          ))}
          {results.length > 0 && <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-ink/45">Issues</p>}
          {results.map((issue, k) => {
            const i = shown.length + k;
            return (
              <button key={issue.id} type="button" onMouseEnter={() => setIndex(i)} onClick={go(`/issues/${issue.id}`)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${index === i ? "bg-accent/12" : ""}`}>
                <CategoryChip category={issue.category} icon={issue.customIcon} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{issueLabel(issue)} <span className="font-normal text-ink/45">{issue.ticket}</span></span>
                  <span className="block truncate text-xs text-ink/50">{issue.address ?? issue.description}</span>
                </span>
                <StatusBadge status={issue.status} />
                {index === i && <ArrowRight size={14} className="text-accent" aria-hidden />}
              </button>
            );
          })}
          {total === 0 && <p className="px-3 py-8 text-center text-sm text-ink/50">Nothing matches “{q}”.</p>}
        </div>
        <div className="flex items-center gap-4 border-t border-ink/10 px-4 py-2 text-[11px] text-ink/45">
          <span>↑ ↓ to move</span>
          <span>Enter to open</span>
          <span className="ml-auto">CiviConnect</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
