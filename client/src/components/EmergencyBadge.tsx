import { Siren } from "lucide-react";
import { EMERGENCY_META } from "../lib/constants";
import type { Issue } from "../types";

// Red, gently pulsing badge for issues that are dangerous right now.
export function EmergencyBadge({ emergency, size = "sm" }: { emergency: Issue["emergency"]; size?: "sm" | "md" }) {
  if (!emergency) return null;
  const meta = EMERGENCY_META[emergency.kind] ?? EMERGENCY_META.other_danger;
  return (
    <span
      className={`cc-emergency inline-flex items-center gap-1 rounded-full bg-alert font-semibold text-white ${size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]"}`}
      title={`Emergency: ${meta.label}. Must be made safe within 4 hours.`}
    >
      <Siren size={size === "md" ? 14 : 12} aria-hidden /> {size === "md" ? `Emergency · ${meta.label}` : "Emergency"}
    </span>
  );
}
