// A small progress ring for a single percentage (a "hero number" with a gauge).
export function Ring({ value, size = 88, stroke = 9, tone = "var(--c-resolved)", label }: { value: number | null; size?: number; stroke?: number; tone?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `${value ?? "No data"}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity=".1" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={tone}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-current font-display" fontSize={size * 0.24} fontWeight={700}>
        {value === null ? "–" : `${Math.round(value)}%`}
      </text>
    </svg>
  );
}
