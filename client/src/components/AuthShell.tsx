import type { ReactNode } from "react";
import { Camera, MapPinned, ShieldCheck } from "lucide-react";

const points = [
  { icon: Camera, text: "Report a pothole, garbage, drainage, street light or tree problem with a photo." },
  { icon: MapPinned, text: "Reports of the same problem nearby are merged, so the fix gets higher priority." },
  { icon: ShieldCheck, text: "Follow every step from reported to resolved, with the officer's notes." },
];

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid overflow-hidden rounded-xl border border-ink/15 bg-white lg:grid-cols-[1fr_1.1fr]">
      <div className="bg-signboard p-8 text-white lg:p-10">
        <p className="text-sm font-medium uppercase tracking-widest text-white/60">CiviConnect</p>
        <h2 className="mt-4 max-w-xs text-2xl font-semibold leading-snug">
          Fix your street, not just complain about it.
        </h2>
        <ul className="mt-8 space-y-5">
          {points.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 text-sm text-white/85">
              <Icon size={18} className="mt-0.5 shrink-0 text-marker" aria-hidden />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="p-8 lg:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {children}
      </div>
    </div>
  );
}
