import { PRIORITY_META } from "../lib/constants";
import type { PriorityLabel } from "../types";

export function PriorityMeter({ score, label }: { score: number; label: PriorityLabel }) {
  const meta = PRIORITY_META[label];
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="font-semibold" style={{ color: meta.hex }}>{meta.label}</span>
        <span className="tabular-nums text-ink/55">{score}/100</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/10">
        <div className={`h-full rounded-full transition-[width] duration-700 ${meta.bar}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
