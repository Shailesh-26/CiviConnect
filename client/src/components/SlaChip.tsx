import { AlarmClock, CircleCheck, Flame, Hourglass, TimerOff } from "lucide-react";
import { formatSpan, liveSla } from "../lib/sla";
import { useNow } from "../lib/useNow";
import type { Sla } from "../types";

const STYLE = {
  ok: { icon: Hourglass, cls: "bg-ink/6 text-ink/70" },
  warning: { icon: AlarmClock, cls: "bg-marker/20 text-marker-dark" },
  breached: { icon: Flame, cls: "bg-alert/12 text-alert" },
  met: { icon: CircleCheck, cls: "bg-resolved/12 text-resolved" },
  missed: { icon: TimerOff, cls: "bg-alert/10 text-alert" },
} as const;

// "Fix by: 5 h left", "Overdue 2 d", "Fixed on time". Ticks every minute.
export function SlaChip({ sla, compact = false }: { sla: Sla; compact?: boolean }) {
  const now = useNow();
  const live = liveSla(sla, now);
  if (live.state === "none") return null;
  const { icon: Icon, cls } = STYLE[live.state];
  const text =
    live.state === "breached"
      ? `Overdue ${formatSpan(live.hoursLeft)}`
      : live.state === "met"
        ? "Fixed on time"
        : live.state === "missed"
          ? "Fixed late"
          : compact
            ? `${formatSpan(live.hoursLeft)} left`
            : `Fix within ${formatSpan(live.hoursLeft)}`;
  return (
    <span
      title={`Fix-by time: ${new Date(live.dueAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} (${live.hours} h allowed)`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${cls} ${live.state === "breached" ? "animate-pulse" : ""}`}
    >
      <Icon size={12} aria-hidden /> {text}
    </span>
  );
}
