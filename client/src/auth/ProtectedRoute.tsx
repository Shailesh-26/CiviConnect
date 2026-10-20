import { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Skeleton } from "../components/ui";
import { useToast } from "../lib/toast-context";
import type { Role } from "../types";
import { useAuth } from "./useAuth";

const PLURAL: Record<Role, string> = { citizen: "citizens", officer: "officers", admin: "admins" };

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const toast = useToast();
  const denied = Boolean(user && roles && !roles.includes(user.role));

  // Say why before sending someone back, instead of silently bouncing them to their home page.
  const told = useRef(false);
  useEffect(() => {
    if (!denied || told.current || !roles) return;
    told.current = true;
    toast.error(`That page is only for ${roles.map((r) => PLURAL[r]).join(" and ")}. You've been taken back to your home page.`, { title: "No access" });
  }, [denied, roles, toast]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-40 w-full !rounded-2xl" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (denied) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
