import { STATUS_META } from "../lib/constants";
import type { Status } from "../types";

export function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badge}`}>
      <span className="size-1.5 rounded-full" style={{ background: meta.hex }} aria-hidden />
      {meta.label}
    </span>
  );
}
