import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Skeleton } from "../components/ui";
import type { Role } from "../types";
import { useAuth } from "./useAuth";

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-40 w-full !rounded-2xl" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
