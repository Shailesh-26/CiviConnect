import { BrainCircuit, CircleCheck, MapPinOff, TriangleAlert } from "lucide-react";
import type { FixCheck } from "../types";

const COPY: Record<FixCheck["verdict"], { title: string; text: string; tone: string; icon: typeof CircleCheck }> = {
  looks_fixed: { title: "Looks fixed", text: "Same place as the citizens' photos, and the problem is no longer visible.", tone: "border-resolved/30 bg-resolved/8 text-resolved", icon: CircleCheck },
  still_visible: { title: "Problem may still be visible", text: "The proof photo still looks like this problem. Admins were asked to double-check.", tone: "border-marker/50 bg-marker/12 text-marker-dark", icon: TriangleAlert },
  different_place: { title: "May be a different place", text: "The proof photo doesn't look like the spot in the citizens' photos. Admins were asked to double-check.", tone: "border-marker/50 bg-marker/12 text-marker-dark", icon: MapPinOff },
};

// The result of the AI fix check on the officer's proof photo. Advisory: people still decide.
export function FixCheckNote({ check }: { check: FixCheck }) {
  const c = COPY[check.verdict];
  return (
    <div className={`mt-3 flex gap-3 rounded-xl border p-3 text-sm animate-fade ${c.tone}`}>
      <c.icon size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 text-ink/80">
        <p className="flex flex-wrap items-center gap-x-2 font-semibold">
          <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-ink/50"><BrainCircuit size={13} aria-hidden /> AI fix check</span>
          <span>{c.title}</span>
          {check.reviewed && <span className="rounded-full bg-resolved/15 px-2 py-0.5 text-[11px] text-resolved">Reviewed by an admin</span>}
        </p>
        <p className="mt-0.5 text-xs text-ink/60">{c.text}</p>
        {check.similarity !== null && (
          <p className="mt-1 text-[11px] text-ink/50">Place match {Math.round(check.similarity * 100)}% with {check.comparedWith} citizen {check.comparedWith === 1 ? "photo" : "photos"} · advisory, a person makes the final call</p>
        )}
      </div>
    </div>
  );
}
