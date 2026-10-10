import { Link } from "react-router-dom";
import { ArrowBigUp, ExternalLink, GitMerge, Sparkles } from "lucide-react";
import { formatDistance } from "../lib/community";
import { issueLabel } from "../lib/constants";
import type { NearbyItem } from "../types";
import { CategoryChip } from "./CategoryChip";
import { StatusBadge } from "./StatusBadge";

type Props = {
  items: NearbyItem[] | null;
  loading: boolean;
  canSupport: boolean;
  supportingId: string | null;
  onSupport: (item: NearbyItem) => void;
};

// "Is this already reported?" panel shown while choosing the location.
export function SimilarIssues({ items, loading, canSupport, supportingId, onSupport }: Props) {
  if (loading && !items) {
    return <div className="skeleton h-24 w-full !rounded-2xl" />;
  }
  if (!items) return null;
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-resolved/30 bg-resolved/8 px-4 py-3 text-sm text-ink/75">
        <Sparkles size={16} className="text-resolved" aria-hidden /> Nothing open within 200 m. You will be the first to report this spot.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      <p className="text-sm font-semibold">Already reported near this spot?</p>
      {items.map((item) => {
        const tone = item.confidence >= 75 ? "bg-alert" : item.confidence >= 50 ? "bg-marker" : "bg-ink/30";
        return (
          <div key={item.id} className={`rounded-2xl border p-3 transition ${item.willMerge ? "border-marker/60 bg-marker/8" : "border-ink/10 bg-surface"}`}>
            <div className="flex items-start gap-3">
              <CategoryChip category={item.category} icon={item.customIcon} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{issueLabel(item)} <span className="font-normal text-ink/45">· {formatDistance(item.distanceM)}</span></p>
                <p className="truncate text-xs text-ink/55">{item.address || item.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                    <span className={`block h-full rounded-full ${tone}`} style={{ width: `${item.confidence}%` }} />
                  </span>
                  <span className="w-20 text-right text-xs font-semibold tabular-nums">{item.confidence}% match</span>
                </div>
              </div>
              <StatusBadge status={item.status} />
            </div>
            {item.willMerge && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-marker-dark">
                <GitMerge size={13} aria-hidden /> Same kind of problem within 50 m: your report will be added to this one.
              </p>
            )}
            <div className="mt-2.5 flex flex-wrap gap-2">
              {canSupport && (
                <button
                  type="button"
                  onClick={() => onSupport(item)}
                  disabled={item.supportedByMe || supportingId === item.id}
                  className="btn btn-marker !px-3 !py-1.5 text-xs"
                >
                  <ArrowBigUp size={15} aria-hidden />
                  {item.supportedByMe ? "You already upvoted this" : supportingId === item.id ? "Adding…" : "Same problem: upvote instead"}
                </button>
              )}
              <Link to={`/issues/${item.id}`} target="_blank" className="btn btn-ghost !px-3 !py-1.5 text-xs">
                Open <ExternalLink size={13} aria-hidden />
              </Link>
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-ink/45">Match is a guide based on distance, kind of problem and shared words. You decide.</p>
    </div>
  );
}
