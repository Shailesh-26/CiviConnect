import { PRIORITY_META } from "../lib/constants";
import type { PriorityLabel } from "../types";

export function PriorityMeter({ score, label }: { score: number; label: PriorityLabel }) {
  const meta = PRIORITY_META[label];
  return (
    <div>
      <div className="flex justify-between text-xs text-ink/60">
        <span>{meta.label}</span>
        <span className="tabular-nums">{score}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10">
        <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
