import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ChartColumn, FilePlus2, LayoutDashboard, ListChecks, LogOut, Map as MapIcon, ShieldUser, type LucideIcon } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { useToast } from "../lib/toast-context";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = { to: string; icon: LucideIcon; label: string };

const sideClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
    isActive ? "bg-accent/12 text-accent" : "text-ink/65 hover:bg-ink/5 hover:text-ink"
  }`;

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors ${
    isActive ? "text-accent" : "text-ink/55"
  }`;

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [leaving, setLeaving] = useState(false);

  if (!user) return null;

  const items: NavItem[] = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/report", icon: FilePlus2, label: "Report" },
    user.role === "citizen"
      ? { to: "/my-reports", icon: ListChecks, label: "My reports" }
      : { to: "/issues", icon: ListChecks, label: "Queue" },
    { to: "/map", icon: MapIcon, label: "Map" },
    ...(user.role !== "citizen" ? [{ to: "/analytics", icon: ChartColumn, label: "Analytics" }] : []),
    ...(user.role === "admin" ? [{ to: "/admin", icon: ShieldUser, label: "Admin" }] : []),
  ];

  async function onLogout() {
    setLeaving(true);
    try {
      await logout();
      toast.info("You have been logged out.");
      navigate("/");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-ink/10 bg-surface px-4 py-6 lg:flex">
        <div className="px-2"><Logo to="/dashboard" /></div>
        <nav className="mt-10 flex flex-1 flex-col gap-1">
          {items.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={sideClass}>
              <Icon size={19} aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="rounded-2xl bg-ink/5 p-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-signboard font-display text-base font-bold text-white">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs capitalize text-ink/55">{user.role === "officer" && user.department ? user.department : user.role}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={onLogout} disabled={leaving} className="btn btn-outline flex-1 !py-2 text-xs">
              <LogOut size={15} aria-hidden /> Log out
            </button>
            <ThemeToggle className="!size-9 border border-ink/15" />
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-[1500] flex items-center justify-between border-b border-ink/10 bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
          <Logo to="/dashboard" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button onClick={onLogout} disabled={leaving} aria-label="Log out" className="btn btn-ghost size-10 !p-0">
              <LogOut size={18} aria-hidden />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-8 lg:pb-12 lg:pt-10">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-[2000] flex gap-1 rounded-2xl border border-ink/10 bg-surface/95 p-1.5 shadow-lift backdrop-blur lg:hidden" aria-label="Main">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={tabClass}>
            <Icon size={20} aria-hidden /> {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
