import type { Sla } from "../types";

export function formatSpan(hours: number) {
  const h = Math.abs(hours);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) {
    const minutes = Math.round(h * 60);
    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    return hh < 10 && mm >= 15 ? `${hh} h ${mm} m` : `${Math.round(h)} h`;
  }
  return `${Math.round(h / 24)} d`;
}

// Recompute hours left against a live clock, so chips count down between reloads.
export function liveSla(sla: Sla, now: number) {
  const hoursLeft = (new Date(sla.dueAt).getTime() - now) / 3_600_000;
  let state = sla.state;
  if (state === "ok" || state === "warning" || state === "breached") {
    state = hoursLeft < 0 ? "breached" : hoursLeft < sla.hours * 0.25 ? "warning" : "ok";
  }
  return { ...sla, hoursLeft, state };
}
