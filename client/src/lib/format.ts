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
