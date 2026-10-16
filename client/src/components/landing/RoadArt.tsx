// A small illustrated road scene used by the landing page demos. `fixed` shows the repaired road.
export function RoadArt({ fixed = false, className = "" }: { fixed?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <rect width="320" height="200" fill="#b9c8ae" />
      <path d="M0 0h108L0 120z" fill="#a7b99a" />
      <path d="M320 0H212l108 120z" fill="#a7b99a" />
      <circle cx="292" cy="40" r="22" fill="#7f9a6e" />
      <circle cx="276" cy="30" r="14" fill="#8daa7b" />
      <circle cx="26" cy="60" r="16" fill="#8daa7b" />
      <path d="M118 0h84l118 200H0z" fill="#4b5159" />
      <path d="M118 0 0 200M202 0l118 200" stroke="#e9ecef" strokeWidth="3" opacity=".8" />
      <path d="M160 0v200" stroke="#e8cf6a" strokeWidth="4" strokeDasharray="16 14" />
      <g className="transition-opacity duration-700" style={{ opacity: fixed ? 0 : 1 }}>
        <ellipse cx="112" cy="142" rx="50" ry="20" fill="#2b2e33" />
        <ellipse cx="112" cy="145" rx="38" ry="13" fill="#1c1e22" />
        <ellipse cx="104" cy="146" rx="20" ry="5" fill="#7d9fc2" opacity=".55" />
        <path d="M62 140l-16-8m22 18-20 10m88-14 18-6m-22 16 14 12M104 122l-4-14" stroke="#2b2e33" strokeWidth="2.5" strokeLinecap="round" />
        <g transform="translate(182 120)">
          <path d="M14 0 26 44H2z" fill="#f07c24" />
          <path d="M8 18h12M5 30h18" stroke="#fff" strokeWidth="4" />
          <rect x="-4" y="44" width="36" height="6" rx="2" fill="#d4661a" />
        </g>
      </g>
      <g className="transition-opacity duration-700" style={{ opacity: fixed ? 1 : 0 }}>
        <path d="M58 126h108l6 36H52z" fill="#3c4148" stroke="#5c626b" strokeWidth="2" />
        <path d="M70 140h80" stroke="#474c54" strokeWidth="2" strokeDasharray="6 8" />
      </g>
    </svg>
  );
}
