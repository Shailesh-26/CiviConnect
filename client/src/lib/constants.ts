import {
  Construction,
  CircleHelp,
  Droplets,
  Lightbulb,
  Trash2,
  TreeDeciduous,
  type LucideIcon,
} from "lucide-react";
import type { Category, Channel, PriorityLabel, Source, Status } from "../types";

// Order matters: charts draw categories in this order, and the colours below were checked
// (dataviz palette validator) so neighbours stay distinguishable, also for colour-blind readers.
export const CATEGORIES: { value: Category; label: string; icon: LucideIcon }[] = [
  { value: "pothole", label: "Pothole", icon: Construction },
  { value: "drainage", label: "Drainage", icon: Droplets },
  { value: "garbage", label: "Garbage", icon: Trash2 },
  { value: "fallen_tree", label: "Fallen tree", icon: TreeDeciduous },
  { value: "streetlight", label: "Street light", icon: Lightbulb },
  { value: "other", label: "Other", icon: CircleHelp },
];

// Each category has its own colour so lists, pins and charts stay recognisable at a glance.
export const CATEGORY_COLOR: Record<Category, string> = {
  pothole: "#eb6834",
  drainage: "#2a78d6",
  garbage: "#008300",
  fallen_tree: "#6250d6",
  streetlight: "#eda100",
  other: "#e87ba4",
};

// The same hues stepped for the dark background (used by charts in dark mode).
export const CATEGORY_COLOR_DARK: Record<Category, string> = {
  pothole: "#d95926",
  drainage: "#3987e5",
  garbage: "#008300",
  fallen_tree: "#9085e9",
  streetlight: "#c98500",
  other: "#d55181",
};

export const categoryMeta = (value: Category) =>
  CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];

// The name shown for an issue: the category, or the reporter's own name for an "Other" problem.
export const issueLabel = (item: { category: Category; customLabel?: string | null }) =>
  item.category === "other" && item.customLabel ? item.customLabel : categoryMeta(item.category).label;

// How a report reached the city. Citizen reports carry no extra label.
export const SOURCE_META: Record<Source, { label: string; short: string } | null> = {
  citizen: null,
  field_inspection: { label: "Logged during a field inspection", short: "Field inspection" },
  on_behalf: { label: "Registered by the office for a citizen", short: "On behalf" },
};

export const CHANNEL_META: Record<Channel, string> = {
  phone: "Phone call",
  walk_in: "Walk-in",
  email: "Email",
  letter: "Letter",
};

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
