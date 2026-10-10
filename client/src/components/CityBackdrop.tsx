import { ARTERIALS, BLOCKS, LAKE, PINS } from "../lib/cityMap";

const PIN_PATH = "M0 0c-2-9-14-14-14-25a14 14 0 0 1 28 0c0 11-12 16-14 25z";

// Full-screen animated city plan behind the login and register card.
// Pins keep appearing around town (new reports), some turn green (fixed), and three nearby
// reports drift together into one issue, which is the core idea of CiviConnect.
export function CityBackdrop() {
  return (
    <svg className="absolute inset-0 size-full" viewBox="0 0 1700 1080" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g className="cc-drift">
        <rect x="-100" y="-100" width="1900" height="1300" style={{ fill: "var(--c-paper)" }} />
        {BLOCKS.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={Math.max(0, b.w)}
            height={Math.max(0, b.h)}
            rx="10"
            style={{ fill: b.kind === "park" ? "var(--c-resolved)" : "var(--c-ink)" }}
            fillOpacity={b.kind === "park" ? 0.13 : 0.055}
          />
        ))}
        <path d={LAKE} style={{ fill: "var(--c-accent)" }} fillOpacity=".13" />
        {ARTERIALS.map((d) => (
          <g key={d}>
            <path d={d} fill="none" style={{ stroke: "var(--c-ink)" }} strokeOpacity=".08" strokeWidth="34" strokeLinecap="round" />
            <path d={d} fill="none" style={{ stroke: "var(--c-surface)" }} strokeWidth="26" strokeLinecap="round" />
            <path d={d} fill="none" style={{ stroke: "var(--c-marker)" }} strokeOpacity=".55" strokeWidth="2" strokeDasharray="14 12" />
          </g>
        ))}

        {PINS.map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y})`}>
            <g className="cc-bd-pin" style={{ animationDelay: `${p.delay}s` }}>
              <ellipse cx="0" cy="2" rx="9" ry="3" fill="#000" fillOpacity=".15" />
              <circle className="cc-bd-ring" cx="0" cy="-25" r="14" fill="none" stroke={p.resolved ? "#2e7d5b" : p.color} strokeWidth="2" style={{ animationDelay: `${p.delay}s` }} />
              <path d={PIN_PATH} fill={p.resolved ? "#2e7d5b" : p.color} stroke="#fff" strokeWidth="2.5" />
              {p.resolved ? (
                <path d="M-5 -25l3.5 3.5L5.5 -29" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <circle cx="0" cy="-25" r="4.5" fill="#fff" />
              )}
            </g>
          </g>
        ))}

        <g transform="translate(270 470)">
          <circle className="cc-merge-glow" r="40" style={{ fill: "var(--c-marker)" }} fillOpacity=".18" />
          <circle className="cc-merge-a" r="9" style={{ fill: "var(--c-marker)" }} stroke="#fff" strokeWidth="3" />
          <circle className="cc-merge-b" r="9" style={{ fill: "var(--c-marker)" }} stroke="#fff" strokeWidth="3" />
          <circle className="cc-merge-c" r="9" style={{ fill: "var(--c-marker)" }} stroke="#fff" strokeWidth="3" />
        </g>
      </g>
    </svg>
  );
}
