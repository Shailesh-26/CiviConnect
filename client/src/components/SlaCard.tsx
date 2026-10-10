import { Flame, Timer } from "lucide-react";
import { formatSpan, liveSla } from "../lib/sla";
import { useNow } from "../lib/useNow";
import type { Sla } from "../types";

// The issue's service clock: how much of the allowed fix time is used up.
export function SlaCard({ sla, createdAt }: { sla: Sla; createdAt: string }) {
  const now = useNow(30_000);
  const live = liveSla(sla, now);
  if (live.state === "none") return null;
  const start = new Date(createdAt).getTime();
  const due = new Date(live.dueAt).getTime();
  const used = Math.min(1, Math.max(0, (now - start) / Math.max(1, due - start)));
  const tone =
    live.state === "breached" || live.state === "missed" ? "bg-alert" : live.state === "warning" ? "bg-marker" : live.state === "met" ? "bg-resolved" : "bg-accent";
  const headline =
    live.state === "breached"
      ? `Overdue by ${formatSpan(live.hoursLeft)}`
      : live.state === "met"
        ? "Fixed within the promised time"
        : live.state === "missed"
          ? "Fixed, but later than promised"
          : `${formatSpan(live.hoursLeft)} left to fix`;

  return (
    <div className={`card p-5 ${live.state === "breached" ? "border-alert/40" : ""}`}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink/50">
        <Timer size={14} aria-hidden /> Fix-by clock · {live.hours} h allowed
      </p>
      <p className={`mt-2 font-display text-2xl font-bold ${live.state === "breached" || live.state === "missed" ? "text-alert" : live.state === "met" ? "text-resolved" : ""}`}>{headline}</p>
      {(live.state === "ok" || live.state === "warning" || live.state === "breached") && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={Math.round(used * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Share of fix time used">
          <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${used * 100}%` }} />
        </div>
      )}
      <p className="mt-2 text-xs text-ink/55">
        Due {new Date(live.dueAt).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
      </p>
      {live.escalated && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-alert/10 px-3 py-2 text-xs font-medium text-alert">
          <Flame size={14} className="mt-0.5 shrink-0" aria-hidden /> Escalated automatically: admins were alerted and the priority was raised.
        </p>
      )}
    </div>
  );
}
