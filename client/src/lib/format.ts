export function formatDuration(hours: number | null) {
  if (hours === null) return "No data";
  if (hours < 1) return "Under 1 hour";
  if (hours < 48) return `${Math.round(hours)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}

export function averageResolutionHours(items: { createdAt: string; resolvedAt: string | null }[]) {
  const done = items.filter((i) => i.resolvedAt);
  if (done.length === 0) return null;
  const total = done.reduce(
    (sum, i) => sum + (new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()),
    0,
  );
  return total / done.length / 3_600_000;
}

export function timeAgo(iso: string | Date) {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export const daysOpen = (createdAt: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000));
