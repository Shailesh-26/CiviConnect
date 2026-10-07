import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "font-medium text-signboard" : "text-ink/70 hover:text-ink";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/15 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link to="/" className="text-lg font-semibold tracking-tight text-signboard">
            CiviConnect
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            {user ? (
              <>
                <NavLink to="/dashboard" className={navClass}>
                  Dashboard
                </NavLink>
                {user.role === "admin" && (
                  <NavLink to="/admin" className={navClass}>
                    Admin
                  </NavLink>
                )}
                <span className="text-ink/60">
                  {user.name} · {user.role}
                </span>
                <button onClick={onLogout} className="text-ink/70 hover:text-ink">
                  Log out
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
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
