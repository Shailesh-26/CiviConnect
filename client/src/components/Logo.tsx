import { Link } from "react-router-dom";

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="15" fill="var(--c-signboard)" />
      <path d="M32 11c-9 0-15.500 6.600-15.500 15 0 10.700 11.500 21.200 14.400 23.600.6.500 1.500.5 2.100 0C35.900 47.200 47.500 36.700 47.500 26 47.500 17.600 41 11 32 11z" fill="#e0a100" />
      <circle cx="32" cy="26" r="6.500" fill="var(--c-signboard)" />
      <path d="M14 53h36" stroke="#fff" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" strokeDasharray="7 6" />
    </svg>
  );
}

export function Logo({ to = "/", light = false }: { to?: string; light?: boolean }) {
  return (
    <Link to={to} className={`flex items-center gap-2.5 ${light ? "text-white" : "text-ink"}`}>
      <LogoMark />
      <span className="font-display text-xl font-bold tracking-tight">
        Civi<span className={light ? "text-marker" : "text-accent"}>Connect</span>
      </span>
    </Link>
  );
}
