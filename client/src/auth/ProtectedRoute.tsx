import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "../types";
import { useAuth } from "./useAuth";

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="px-6 py-16 text-ink/60">Loading…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
