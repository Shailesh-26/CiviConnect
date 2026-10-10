import { createContext, useContext } from "react";
import type { AppNotification } from "../types";

export type LiveEvent = { type: "notification"; data: AppNotification } | { type: "refresh"; data: { reason: string } };

export type NotificationState = {
  items: AppNotification[];
  unread: number;
  connected: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  // Live screens subscribe to know when to reload. Returns an unsubscribe function.
  subscribe: (fn: (event: LiveEvent) => void) => () => void;
};

export const NotificationContext = createContext<NotificationState | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}
