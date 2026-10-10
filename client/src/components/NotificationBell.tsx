import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  AlarmClock,
  Bell,
  BellOff,
  CheckCheck,
  CircleCheck,
  Flag,
  Flame,
  GitMerge,
  Inbox,
  MessageSquare,
  RotateCcw,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useNotifications } from "../lib/notification-context";
import { timeAgo } from "../lib/format";
import type { NotificationType } from "../types";

const ICON: Record<NotificationType, { icon: LucideIcon; cls: string }> = {
  status: { icon: Sparkles, cls: "bg-accent/12 text-accent" },
  resolved: { icon: CircleCheck, cls: "bg-resolved/15 text-resolved" },
  comment: { icon: MessageSquare, cls: "bg-accent/12 text-accent" },
  merged: { icon: GitMerge, cls: "bg-marker/20 text-marker-dark" },
  assigned: { icon: UserPlus, cls: "bg-accent/12 text-accent" },
  sla_warning: { icon: AlarmClock, cls: "bg-marker/20 text-marker-dark" },
  escalated: { icon: Flame, cls: "bg-alert/12 text-alert" },
  reopened: { icon: RotateCcw, cls: "bg-alert/12 text-alert" },
  new_issue: { icon: Inbox, cls: "bg-accent/12 text-accent" },
  unassigned: { icon: Inbox, cls: "bg-marker/20 text-marker-dark" },
  flag: { icon: Flag, cls: "bg-alert/12 text-alert" },
};

// The bell with an unread count; opens a panel of recent notifications.
export function NotificationBell({ placement = "below" }: { placement?: "below" | "side" }) {
  const { items, unread, connected, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [spot, setSpot] = useState<{ top: number; left: number } | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  function toggle() {
    if (spot) return setSpot(null);
    const r = button.current!.getBoundingClientRect();
    const width = Math.min(400, window.innerWidth - 16);
    if (placement === "side" && window.innerWidth >= 1024) setSpot({ top: Math.max(8, r.top - 8), left: r.right + 12 });
    else setSpot({ top: r.bottom + 8, left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)) });
  }

  useEffect(() => {
    if (!spot) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setSpot(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSpot(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [spot]);

  const shown = filter === "unread" ? items.filter((n) => !n.read) : items;

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={Boolean(spot)}
        className="relative grid size-10 place-items-center rounded-xl text-ink/70 transition hover:bg-ink/6 hover:text-ink"
      >
        <Bell size={19} aria-hidden className={unread ? "origin-top animate-[cc-ring_1.2s_ease-in-out_1]" : ""} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid min-w-[1.15rem] place-items-center rounded-full bg-alert px-1 text-[10px] font-bold leading-[1.15rem] text-white ring-2 ring-surface animate-pop">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {spot &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label="Notifications"
            style={{ top: spot.top, left: spot.left, width: Math.min(400, window.innerWidth - 16) }}
            className="fixed z-[2600] flex max-h-[min(36rem,calc(100vh-6rem))] flex-col overflow-hidden rounded-3xl border border-ink/10 bg-surface/90 shadow-lift backdrop-blur-2xl animate-pop"
          >
            <div className="flex items-center gap-2 border-b border-ink/8 px-4 py-3">
              <h2 className="font-display text-lg font-semibold">Notifications</h2>
              <span className={`ml-1 inline-flex items-center gap-1 text-[11px] ${connected ? "text-resolved" : "text-ink/45"}`} title={connected ? "Live updates are on" : "Reconnecting…"}>
                <span className={`size-1.5 rounded-full ${connected ? "bg-resolved" : "bg-ink/30"}`} /> {connected ? "Live" : "Offline"}
              </span>
              <button type="button" onClick={markAllRead} disabled={!unread} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-accent hover:bg-accent/10 disabled:opacity-40">
                <CheckCheck size={14} aria-hidden /> Mark all read
              </button>
            </div>
            <div className="flex gap-1 px-4 pt-3">
              {(["all", "unread"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${filter === f ? "bg-ink text-paper" : "text-ink/60 hover:bg-ink/6"}`}>
                  {f}{f === "unread" && unread ? ` · ${unread}` : ""}
                </button>
              ))}
            </div>
            <ul className="cc-scroll mt-2 flex-1 overflow-y-auto px-2 pb-2">
              {shown.length === 0 ? (
                <li className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-ink/55">
                  <BellOff size={26} className="text-ink/30" aria-hidden />
                  {filter === "unread" ? "You are all caught up." : "Nothing yet. Updates on your issues will appear here."}
                </li>
              ) : (
                shown.map((n) => {
                  const { icon: Icon, cls } = ICON[n.type] ?? ICON.status;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!n.read) markRead(n.id);
                          setSpot(null);
                          if (n.link) navigate(n.link);
                        }}
                        className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-ink/5 ${n.read ? "" : "bg-accent/[0.06]"}`}
                      >
                        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${cls}`}><Icon size={17} aria-hidden /></span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm leading-snug ${n.read ? "text-ink/75" : "font-semibold"}`}>{n.title}</span>
                          {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-ink/55">{n.body}</span>}
                          <span className="mt-1 block text-[11px] text-ink/45">{timeAgo(n.createdAt)}</span>
                        </span>
                        {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
