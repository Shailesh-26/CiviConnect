import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ChartColumn,
  FilePlus2,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Map as MapIcon,
  MapPin,
  ShieldUser,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ${
    isActive ? "bg-signboard/10 font-medium text-signboard" : "text-ink/70 hover:bg-ink/5 hover:text-ink"
  }`;

function Item({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <NavLink to={to} className={navClass} title={label}>
      <Icon size={17} aria-hidden />
      <span className="hidden md:inline">{label}</span>
    </NavLink>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-[2000] border-b border-ink/15 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-signboard">
            <span className="grid size-8 place-items-center rounded-md bg-signboard text-white">
              <MapPin size={18} aria-hidden />
            </span>
            <span className="hidden sm:inline">CiviConnect</span>
          </Link>
          <nav className="flex items-center gap-1">
            {user ? (
              <>
                <Item to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
                <Item to="/report" icon={FilePlus2} label="Report" />
                {user.role === "citizen" && <Item to="/my-reports" icon={ListChecks} label="My reports" />}
                {user.role !== "citizen" && <Item to="/issues" icon={ListChecks} label="Queue" />}
                <Item to="/map" icon={MapIcon} label="Map" />
                {user.role !== "citizen" && <Item to="/analytics" icon={ChartColumn} label="Analytics" />}
                {user.role === "admin" && <Item to="/admin" icon={ShieldUser} label="Admin" />}
                <span className="mx-2 hidden h-5 w-px bg-ink/15 sm:block" />
                <span className="hidden text-sm text-ink/60 lg:inline">
                  {user.name} · {user.role}
                </span>
                <button
                  onClick={onLogout}
                  title="Log out"
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-ink/70 hover:bg-ink/5 hover:text-ink"
                >
                  <LogOut size={17} aria-hidden />
                  <span className="hidden md:inline">Log out</span>
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navClass}>
                  Log in
                </NavLink>
                <NavLink to="/register" className={navClass}>
                  Register
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
