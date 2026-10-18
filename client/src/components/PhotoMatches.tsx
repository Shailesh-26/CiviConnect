import { Link } from "react-router-dom";
import { ArrowRight, Copy, ScanSearch, ThumbsUp } from "lucide-react";
import { issueLabel, STATUS_META } from "../lib/constants";
import { formatDistance } from "../lib/community";
import type { PhotoMatch } from "../types";

type Props = { matches: PhotoMatch[]; canSupport: boolean; supportingId: string | null; onSupport: (id: string) => void };

// Same-photo duplicate check: the Photo Assistant found report photos that look like this one.
export function PhotoMatches({ matches, canSupport, supportingId, onSupport }: Props) {
  if (!matches.length) return null;
  const exact = matches.some((m) => m.exactSamePhoto);
  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-marker/50 bg-marker/[0.08] p-4 animate-rise" aria-live="polite">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="grid size-7 place-items-center rounded-lg bg-marker/25 text-marker-dark">{exact ? <Copy size={15} aria-hidden /> : <ScanSearch size={15} aria-hidden />}</span>
        {exact ? "This exact photo was already reported" : "Your photo looks like one already reported here"}
      </p>
      <p className="mt-1 text-xs text-ink/60">The Photo Assistant compared your photo with nearby report photos. If it's the same problem, support it instead of reporting again.</p>
      <ul className="mt-3 space-y-2">
        {matches.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-xl border border-ink/10 bg-surface p-2.5">
            <img src={m.photoUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{issueLabel(m)} <span className="font-normal text-ink/45">{m.ticket}</span></p>
              <p className="truncate text-xs text-ink/55">
                {Math.round(m.similarity * 100)}% photo match{m.distanceM !== null ? ` · ${formatDistance(m.distanceM)}` : ""} · {STATUS_META[m.status].label}
              </p>
              <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-ink/10">
                <div className="cc-grow h-full origin-left rounded-full bg-marker" style={{ "--to": m.similarity } as React.CSSProperties} />
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
              {canSupport && m.open && (
                <button type="button" disabled={supportingId === m.id} onClick={() => onSupport(m.id)} className="btn btn-primary !px-3 !py-1.5 text-xs">
                  <ThumbsUp size={13} aria-hidden /> {supportingId === m.id ? "Adding…" : "Support"}
                </button>
              )}
              <Link to={`/issues/${m.id}`} className="btn btn-outline !px-3 !py-1.5 text-xs">Open <ArrowRight size={13} aria-hidden /></Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
