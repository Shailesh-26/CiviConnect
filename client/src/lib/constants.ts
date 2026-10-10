import {
  Construction,
  CircleHelp,
  Droplets,
  Lightbulb,
  Trash2,
  TreeDeciduous,
  type LucideIcon,
} from "lucide-react";
import type { Category, PriorityLabel, Status } from "../types";

export const CATEGORIES: { value: Category; label: string; icon: LucideIcon }[] = [
  { value: "pothole", label: "Pothole", icon: Construction },
  { value: "garbage", label: "Garbage", icon: Trash2 },
  { value: "drainage", label: "Drainage", icon: Droplets },
  { value: "streetlight", label: "Street light", icon: Lightbulb },
  { value: "fallen_tree", label: "Fallen tree", icon: TreeDeciduous },
  { value: "other", label: "Other", icon: CircleHelp },
];

// Each category has its own colour so lists, pins and charts stay recognisable at a glance.
export const CATEGORY_COLOR: Record<Category, string> = {
  pothole: "#c2561f",
  garbage: "#4f7d3a",
  drainage: "#2a7f9e",
  streetlight: "#c99700",
  fallen_tree: "#6b4a8f",
  other: "#5b6b7a",
};

export const categoryMeta = (value: Category) =>
  CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];

export const STATUS_META: Record<Status, { label: string; badge: string; hex: string }> = {
  reported: { label: "Reported", badge: "bg-ink/10 text-ink", hex: "#6b7280" },
  acknowledged: { label: "Acknowledged", badge: "bg-accent/15 text-accent", hex: "#2f73b3" },
  in_progress: { label: "In progress", badge: "bg-marker/20 text-marker-dark", hex: "#e0a100" },
  resolved: { label: "Resolved", badge: "bg-resolved/15 text-resolved", hex: "#2e7d5b" },
  rejected: { label: "Rejected", badge: "bg-alert/10 text-alert", hex: "#b83a2e" },
};

export const NEXT_STATUS: Record<Status, Status[]> = {
  reported: ["acknowledged", "rejected"],
  acknowledged: ["in_progress", "rejected"],
  in_progress: ["resolved", "rejected"],
  resolved: ["in_progress"],
  rejected: [],
};

export const PRIORITY_META: Record<PriorityLabel, { label: string; bar: string; hex: string }> = {
  high: { label: "High", bar: "bg-alert", hex: "#b83a2e" },
  medium: { label: "Medium", bar: "bg-marker", hex: "#e0a100" },
  low: { label: "Low", bar: "bg-accent", hex: "#2f73b3" },
};

export const OPEN: Status[] = ["reported", "acknowledged", "in_progress"];

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
