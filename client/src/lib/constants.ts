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

export const categoryMeta = (value: Category) =>
  CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];

export const STATUS_META: Record<Status, { label: string; badge: string; hex: string }> = {
  reported: { label: "Reported", badge: "bg-ink/10 text-ink", hex: "#6b7280" },
  acknowledged: { label: "Acknowledged", badge: "bg-signboard/10 text-signboard", hex: "#1f4e79" },
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
  low: { label: "Low", bar: "bg-signboard", hex: "#1f4e79" },
};

export const OPEN: Status[] = ["reported", "acknowledged", "in_progress"];

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
