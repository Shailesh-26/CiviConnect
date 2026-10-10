import { Check } from "lucide-react";
import { STATUS_META } from "../lib/constants";
import type { Status } from "../types";

const STAGES: Status[] = ["reported", "acknowledged", "in_progress", "resolved"];

// A four-step tracker so anyone sees at a glance how far the fix has come.
export function StatusTracker({ status }: { status: Status }) {
  if (status === "rejected") {
    return <p className="rounded-xl border border-alert/30 bg-alert/10 px-4 py-3 text-sm font-medium text-alert">This issue was closed without a fix. See the timeline for the reason.</p>;
  }
  const current = STAGES.indexOf(status);
  return (
    <ol className="flex items-start">
      {STAGES.map((stage, i) => {
        const done = i < current || status === "resolved";
        const active = i === current && status !== "resolved";
        return (
          <li key={stage} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && <span className={`absolute right-1/2 top-4 h-0.5 w-full ${i <= current ? "bg-resolved" : "bg-ink/15"}`} aria-hidden />}
            <span
              className={`relative z-10 grid size-8 place-items-center rounded-full border-2 text-xs font-bold transition-colors ${
                done ? "border-resolved bg-resolved text-white" : active ? "border-accent bg-accent text-paper" : "border-ink/20 bg-surface text-ink/40"
              }`}
            >
              {done ? <Check size={15} aria-hidden /> : i + 1}
            </span>
            <span className={`mt-2 text-[11px] font-medium sm:text-xs ${done || active ? "text-ink" : "text-ink/45"}`}>{STATUS_META[stage].label}</span>
          </li>
        );
      })}
    </ol>
  );
}
