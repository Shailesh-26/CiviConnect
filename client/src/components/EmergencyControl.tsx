import { createElement, useState } from "react";
import { ShieldCheck, Siren } from "lucide-react";
import { EMERGENCY_KINDS, EMERGENCY_META } from "../lib/constants";
import type { EmergencyKind, Issue } from "../types";

type Props = { emergency: Issue["emergency"]; busy: boolean; onSet: (emergency: boolean, kind?: EmergencyKind) => void };

// For admins and the assigned officer: raise an issue to an emergency, or clear a false alarm.
export function EmergencyControl({ emergency, busy, onSet }: Props) {
  const [picking, setPicking] = useState(false);
  const [kind, setKind] = useState<EmergencyKind>("other_danger");

  if (emergency) {
    return (
      <div className="rounded-2xl border border-alert/40 bg-alert/8 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-alert"><Siren size={18} aria-hidden /> Emergency: {EMERGENCY_META[emergency.kind].label}</h2>
        <p className="mt-1.5 text-sm text-ink/70">Must be made safe within 4 hours. It sits at the top of every queue.</p>
        <button type="button" disabled={busy} onClick={() => onSet(false)} className="btn btn-outline mt-3 w-full text-sm">
          <ShieldCheck size={16} aria-hidden /> Not an emergency (clear)
        </button>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold"><Siren size={17} className="text-alert" aria-hidden /> Danger to people?</h2>
      {!picking ? (
        <>
          <p className="mt-1.5 text-sm text-ink/60">Raise it to an emergency: 4-hour fix-by time, top of every queue, admins alerted.</p>
          <button type="button" onClick={() => setPicking(true)} className="btn btn-outline mt-3 w-full text-sm text-alert hover:!border-alert hover:!text-alert">Mark as emergency</button>
        </>
      ) : (
        <div className="mt-3 animate-fade">
          <div className="grid grid-cols-2 gap-1.5">
            {EMERGENCY_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition ${kind === k ? "border-alert bg-alert/10 text-alert" : "border-ink/15 hover:border-ink/35"}`}
              >
                {createElement(EMERGENCY_META[k].icon, { size: 14, "aria-hidden": true })} {EMERGENCY_META[k].label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setPicking(false)} className="btn btn-ghost flex-1 text-sm">Cancel</button>
            <button type="button" disabled={busy} onClick={() => onSet(true, kind)} className="btn flex-1 bg-alert text-sm text-white hover:brightness-110">Confirm</button>
          </div>
        </div>
      )}
    </div>
  );
}
