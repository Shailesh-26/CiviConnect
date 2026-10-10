import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Camera, Layers, ShieldCheck } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const points = [
  { icon: Camera, text: "Report a problem with a photo and a pin on the map." },
  { icon: Layers, text: "Reports of the same problem nearby merge, so the fix climbs the priority list." },
  { icon: ShieldCheck, text: "Every fix needs proof, and citizens confirm it before the issue stays closed." },
];

// Three separate reports drift together and become one issue: the core idea of the product.
function MergeAnimation() {
  const pin = (x: number, y: number) => (
    <circle r="9" fill="#e0a100" stroke="#fff" strokeWidth="3">
      <animate attributeName="cx" values={`${x};${x};200;200;${x}`} keyTimes="0;0.15;0.5;0.85;1" dur="7s" repeatCount="indefinite" />
      <animate attributeName="cy" values={`${y};${y};120;120;${y}`} keyTimes="0;0.15;0.5;0.85;1" dur="7s" repeatCount="indefinite" />
    </circle>
  );
  return (
    <svg viewBox="0 0 400 240" className="w-full max-w-md" role="img" aria-label="Three nearby reports merging into one issue">
      <g stroke="#fff" strokeOpacity=".14" strokeWidth="1">
        {Array.from({ length: 11 }, (_, i) => <path key={`v${i}`} d={`M${i * 40} 0V240`} />)}
        {Array.from({ length: 7 }, (_, i) => <path key={`h${i}`} d={`M0 ${i * 40}H400`} />)}
      </g>
      <path d="M0 150 C100 110 160 190 260 130 S360 100 400 120" stroke="#fff" strokeOpacity=".25" strokeWidth="14" fill="none" />
      <circle cx="200" cy="120" r="28" fill="#e0a100" opacity=".18">
        <animate attributeName="r" values="12;38;12" dur="7s" repeatCount="indefinite" />
      </circle>
      {pin(70, 60)}
      {pin(330, 70)}
      {pin(110, 190)}
      <text x="200" y="228" textAnchor="middle" fill="#fff" fillOpacity=".7" fontSize="13">
        3 reports → 1 issue, higher priority
      </text>
    </svg>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-signboard p-10 text-white lg:flex lg:flex-col">
        <div className="grid-paper pointer-events-none absolute inset-0 opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" aria-hidden />
        <div className="relative"><Logo light /></div>
        <div className="relative my-auto py-10">
          <h2 className="max-w-md font-display text-4xl font-semibold leading-[1.1]">
            Fix your street,
            <br />
            <span className="text-marker">not just complain</span> about it.
          </h2>
          <div className="mt-8"><MergeAnimation /></div>
          <ul className="mt-8 max-w-md space-y-4">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 text-sm text-white/85">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10">
                  <Icon size={16} className="text-marker" aria-hidden />
                </span>
                <span className="pt-1">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="btn btn-ghost !px-3 text-sm">
            <ArrowLeft size={16} aria-hidden /> Home
          </Link>
          <ThemeToggle />
        </div>
        <div className="mx-auto my-auto w-full max-w-sm py-10 animate-rise">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-ink/60">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
