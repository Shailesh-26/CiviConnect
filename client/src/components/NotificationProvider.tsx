import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { api } from "../lib/api";
import { NotificationContext, type LiveEvent } from "../lib/notification-context";
import { useToast } from "../lib/toast-context";
import type { AppNotification } from "../types";

// Loads the bell, then keeps one Server-Sent Events connection open for live updates.
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const listeners = useRef(new Set<(e: LiveEvent) => void>());
  const toastRef = useRef(toast);
  const navRef = useRef(navigate);
  useEffect(() => {
    toastRef.current = toast;
    navRef.current = navigate;
  });

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    api<{ items: AppNotification[]; unread: number }>("/notifications")
      .then((data) => {
        if (!active) return;
        setItems(data.items);
        setUnread(data.unread);
      })
      .catch(() => undefined);

    const source = new EventSource("/api/notifications/stream", { withCredentials: true });
    source.addEventListener("hello", () => active && setConnected(true));
    source.addEventListener("notification", (e) => {
      const n = JSON.parse((e as MessageEvent).data) as AppNotification;
      setItems((all) => [n, ...all.filter((x) => x.id !== n.id)].slice(0, 50));
      setUnread((u) => u + 1);
      listeners.current.forEach((fn) => fn({ type: "notification", data: n }));
      toastRef.current.info(n.body ?? "Tap to open.", {
        title: n.title,
        action: n.link ? { label: "Open", onClick: () => navRef.current(n.link!) } : undefined,
      });
    });
    source.addEventListener("refresh", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { reason: string };
      listeners.current.forEach((fn) => fn({ type: "refresh", data }));
    });
    source.onerror = () => active && setConnected(false);

    return () => {
      active = false;
      source.close();
      setConnected(false);
      setItems([]);
      setUnread(0);
    };
  }, [userId]);

  const markRead = useCallback((id: string) => {
    setItems((all) => all.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    void api(`/notifications/${id}/read`, { method: "POST" }).catch(() => undefined);
  }, []);

  const markAllRead = useCallback(() => {
    setItems((all) => all.map((n) => ({ ...n, read: true })));
    setUnread(0);
    void api("/notifications/read-all", { method: "POST" }).catch(() => undefined);
  }, []);

  const subscribe = useCallback((fn: (e: LiveEvent) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const value = useMemo(() => ({ items, unread, connected, markRead, markAllRead, subscribe }), [items, unread, connected, markRead, markAllRead, subscribe]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
