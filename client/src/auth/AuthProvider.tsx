import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError } from "../lib/api";
import type { User } from "../types";
import { AuthContext, SIGNED_OUT_KEY } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Who is logged in? If the server can't be reached, keep asking every few seconds instead of
  // treating it as "logged out", so a server restart never throws anyone back to the login page.
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const check = () => {
      api<{ user: User }>("/auth/me")
        .then((data) => {
          if (!active) return;
          setUser(data.user);
          setLoading(false);
        })
        .catch((err) => {
          if (!active) return;
          if (err instanceof ApiError && err.status === 0) {
            timer = window.setTimeout(check, 4000);
            return;
          }
          if (!(err instanceof ApiError) || err.status !== 401) console.error(err);
          setLoading(false);
        });
    };
    check();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  // The server ended this session: leave the reason for the login page and sign out here too.
  useEffect(() => {
    const onSignedOut = (e: Event) => {
      try {
        sessionStorage.setItem(SIGNED_OUT_KEY, String((e as CustomEvent<string>).detail));
      } catch {
        /* storage blocked: the login page simply shows no reason */
      }
      setUser(null);
    };
    window.addEventListener("cc:signed-out", onSignedOut);
    return () => window.removeEventListener("cc:signed-out", onSignedOut);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await api<{ user: User }>("/auth/register", {
      method: "POST",
      body: { name, email, password },
    });
    setUser(data.user);
    return data.user;
  }, []);

  // Signed out here even if the server can't be reached, so "Log out" always works.
  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((next: User) => setUser(next), []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, updateUser }),
    [user, loading, login, register, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
