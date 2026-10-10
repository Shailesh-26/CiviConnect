import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BriefcaseBusiness,
  ChartColumn,
  ChevronsLeft,
  ChevronsRight,
  ClipboardPen,
  FilePlus2,
  Headset,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Map as MapIcon,
  Radar,
  Radio,
  ShieldUser,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { readSetting, writeSetting } from "../lib/storage";
import { useToast } from "../lib/toast-context";
import type { Role } from "../types";
import { Avatar } from "./Avatar";
import { ConfirmDialog } from "./ConfirmDialog";
import { Logo, LogoMark } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = { to: string; icon: LucideIcon; label: string; short?: string };

const SIDEBAR_KEY = "cc-sidebar";

// Each role files issues in its own way, so the "report" entry is named for what it does.
const REPORT_ITEM: Record<Role, NavItem> = {
  citizen: { to: "/report", icon: FilePlus2, label: "Report" },
  officer: { to: "/report", icon: ClipboardPen, label: "Field inspection", short: "Inspect" },
  admin: { to: "/report", icon: Headset, label: "Log complaint", short: "Log" },
};

function Tooltip({ text, show }: { text: string; show: boolean }) {
  if (!show) return null;
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-paper opacity-0 shadow-lift transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
      {text}
    </span>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [collapsed, setCollapsed] = useState(() => readSetting(SIDEBAR_KEY) === "collapsed");

  const toggleSidebar = useCallback(() => {
    setCollapsed((c) => {
      writeSetting(SIDEBAR_KEY, c ? "open" : "collapsed");
      return !c;
    });
  }, []);

  // Ctrl+B (Cmd+B on Mac) collapses or expands the sidebar, like in most desktop apps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  const cancelLogout = useCallback(() => setConfirming(false), []);

  if (!user) return null;

  const items: NavItem[] = [
    {
      to: "/dashboard",
      icon: user.role === "officer" ? BriefcaseBusiness : user.role === "admin" ? Radio : LayoutDashboard,
      label: user.role === "officer" ? "Field Desk" : user.role === "admin" ? "Command Center" : "Dashboard",
      short: user.role === "officer" ? "Desk" : user.role === "admin" ? "Command" : "Home",
    },
    ...(user.role === "citizen" ? [{ to: "/neighbourhood", icon: Radar, label: "Neighbourhood", short: "Nearby" }] : []),
    REPORT_ITEM[user.role],
    user.role === "citizen"
      ? { to: "/my-reports", icon: ListChecks, label: "My reports", short: "Mine" }
      : { to: "/issues", icon: ListChecks, label: user.role === "officer" ? "My queue" : "All issues", short: "Queue" },
    { to: "/map", icon: MapIcon, label: "Map" },
    ...(user.role !== "citizen" ? [{ to: "/analytics", icon: ChartColumn, label: "Analytics", short: "Stats" }] : []),
    ...(user.role === "admin" ? [{ to: "/admin", icon: ShieldUser, label: "Admin console", short: "Admin" }] : []),
  ];

  const roleLine = user.role === "officer" && user.department ? user.department : user.role;

  async function doLogout() {
    setLeaving(true);
    try {
      await logout();
      toast.info("You have been logged out. See you soon!");
      navigate("/");
    } catch {
      toast.error("Could not log out. Check your connection and try again.");
    } finally {
      setLeaving(false);
      setConfirming(false);
    }
  }

  const sideLink = ({ isActive }: { isActive: boolean }) =>
    `group relative flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors ${
      collapsed ? "justify-center px-0" : "gap-3 px-3.5"
    } ${isActive ? "bg-accent/12 text-accent" : "text-ink/65 hover:bg-ink/5 hover:text-ink"}`;

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors ${
      isActive ? "bg-accent/10 text-accent" : "text-ink/55"
    }`;

  return (
    <div
      className="min-h-screen lg:grid lg:grid-cols-[var(--sidebar)_1fr] lg:transition-[grid-template-columns] lg:duration-300"
      style={{ "--sidebar": collapsed ? "5rem" : "16rem" } as React.CSSProperties}
    >
      <aside className={`sticky top-0 z-[1600] hidden h-screen flex-col border-r border-ink/10 bg-surface py-6 lg:flex ${collapsed ? "px-3" : "px-4"}`}>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={`${collapsed ? "Expand" : "Collapse"} sidebar (Ctrl+B)`}
          className="absolute -right-3.5 top-8 z-10 grid size-7 place-items-center rounded-full border border-ink/15 bg-surface text-ink/60 shadow-card transition hover:scale-110 hover:border-accent hover:text-accent"
        >
          {collapsed ? <ChevronsRight size={15} aria-hidden /> : <ChevronsLeft size={15} aria-hidden />}
        </button>

        <div className={collapsed ? "flex flex-col items-center gap-3" : "flex items-center justify-between pl-2"}>
          {collapsed ? (
            <Link to="/dashboard" aria-label="CiviConnect dashboard"><LogoMark /></Link>
          ) : (
            <Logo to="/dashboard" />
          )}
          <NotificationBell placement="side" />
        </div>

        <nav className="mt-10 flex flex-1 flex-col gap-1" aria-label="Main">
          {items.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={sideLink} aria-label={collapsed ? label : undefined}>
              <Icon size={19} aria-hidden className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
              <Tooltip text={label} show={collapsed} />
            </NavLink>
          ))}
        </nav>

        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Link to="/profile" className="group relative rounded-full ring-2 ring-transparent transition hover:ring-accent" aria-label="Your profile">
              <Avatar name={user.name} avatar={user.avatar} />
              <Tooltip text={user.name} show />
            </Link>
            <ThemeToggle />
            <button onClick={() => setConfirming(true)} aria-label="Log out" title="Log out" className="btn btn-ghost size-10 !p-0 hover:!text-alert">
              <LogOut size={18} aria-hidden />
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-ink/5 p-3">
            <Link to="/profile" className="-m-1 flex items-center gap-3 rounded-xl p-1 transition hover:bg-ink/5" title="Open your profile">
              <Avatar name={user.name} avatar={user.avatar} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{user.name}</span>
                <span className={`block truncate text-xs text-ink/55 ${user.role === "officer" && user.department ? "" : "capitalize"}`}>{roleLine}</span>
              </span>
            </Link>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setConfirming(true)} className="btn btn-outline flex-1 !py-2 text-xs hover:!border-alert hover:!text-alert">
                <LogOut size={15} aria-hidden /> Log out
              </button>
              <ThemeToggle className="!size-9 border border-ink/15" />
            </div>
          </div>
        )}
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-[1500] flex items-center justify-between border-b border-ink/10 bg-surface/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <Logo to="/dashboard" />
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
            <button onClick={() => setConfirming(true)} aria-label="Log out" className="btn btn-ghost size-10 !p-0">
              <LogOut size={18} aria-hidden />
            </button>
            <Link to="/profile" aria-label="Your profile" className="ml-1 rounded-full ring-2 ring-transparent transition active:ring-accent">
              <Avatar name={user.name} avatar={user.avatar} size="sm" />
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-8 lg:pb-12 lg:pt-10">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-[2000] flex gap-1 rounded-2xl border border-ink/10 bg-surface/95 p-1.5 shadow-lift backdrop-blur lg:hidden" aria-label="Main">
        {items.map(({ to, icon: Icon, label, short }) => (
          <NavLink key={to} to={to} className={tabClass}>
            <Icon size={20} aria-hidden /> <span className="max-w-full truncate">{short ?? label}</span>
          </NavLink>
        ))}
      </nav>

      <ConfirmDialog
        open={confirming}
        icon={LogOut}
        tone="danger"
        title="Log out of CiviConnect?"
        message="You will need your email and password to sign back in. Anything you have not submitted yet will be lost."
        confirmLabel="Log out"
        cancelLabel="Stay"
        busy={leaving}
        onConfirm={doLogout}
        onCancel={cancelLogout}
      />
    </div>
  );
}
