import { useState } from "react";
import { Plane } from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";

const isoDay = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type Props = { open: boolean; who: string; self: boolean; openCount?: number; busy: boolean; onConfirm: (until: string | null) => void; onCancel: () => void };

// Start leave for an officer: optional end date, and a clear note that open work is handed over.
export function LeaveDialog({ open, who, self, openCount, busy, onConfirm, onCancel }: Props) {
  const [until, setUntil] = useState("");
  return (
    <ConfirmDialog
      open={open}
      icon={Plane}
      title={self ? "Going on leave?" : `Put ${who} on leave?`}
      confirmLabel="Start leave"
      busy={busy}
      onCancel={onCancel}
      onConfirm={() => onConfirm(until || null)}
      message={
        <div className="space-y-3">
          <p>
            {openCount === undefined
              ? "Their open issues"
              : openCount === 0
                ? "There are no open issues to hand over. "
                : `${openCount} open ${openCount === 1 ? "issue" : "issues"} `}
            {openCount !== 0 && "will be handed to the best available colleague automatically. "}
            New work won't be assigned until {self ? "you're" : "they're"} back. On return, issues nobody has started yet come back; work a colleague has started stays with them.
          </p>
          <label className="block">
            <span className="text-xs font-semibold text-ink/70">Back on (optional)</span>
            <input type="date" value={until} min={isoDay(0)} max={isoDay(90)} onChange={(e) => setUntil(e.target.value)} className="input mt-1 !py-2 text-sm" />
            <span className="mt-1 block text-[11px] text-ink/50">Leave ends by itself after this day. Leave it empty to end it by hand.</span>
          </label>
        </div>
      }
    />
  );
}
