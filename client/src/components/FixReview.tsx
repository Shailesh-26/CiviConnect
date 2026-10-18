import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CircleCheck, MapPinOff, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { issueLabel } from "../lib/constants";
import { timeAgo } from "../lib/format";
import { useToast } from "../lib/toast-context";
import type { FixFlag } from "../types";

// Admin queue of fixes the AI fix check was unsure about: look at both photos, then accept or reopen.
export function FixReview() {
  const toast = useToast();
  const [items, setItems] = useState<FixFlag[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api<{ items: FixFlag[] }>("/vision/fix-flags")
      .then((d) => active && setItems(d.items))
      .catch(() => active && setItems([]));
    return () => {
      active = false;
    };
  }, []);

  async function decide(item: FixFlag, reopen: boolean) {
    setBusy(item.id);
    try {
      if (reopen) {
        const form = new FormData();
        form.append("status", "in_progress");
        form.append("note", "Reopened after reviewing the AI fix check: the proof photo did not show a completed fix.");
        await api(`/issues/${item.id}/status`, { method: "PATCH", body: form });
      }
      await api(`/vision/fix-flags/${item.id}/review`, { method: "POST" });
      setItems((all) => (all ?? []).filter((i) => i.id !== item.id));
      toast.success(reopen ? `${item.ticket} was reopened and the officer was told.` : `${item.ticket} marked as reviewed.`, { title: reopen ? "Reopened" : "Fix accepted" });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card p-5">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck size={18} className="text-accent" aria-hidden /> Fixes to double-check</h3>
      <p className="text-sm text-ink/60">When an officer marks an issue fixed, the AI compares the proof photo with the citizens' photos. These are the ones it wasn't sure about.</p>
      {items === null ? (
        <div className="skeleton mt-4 h-24 w-full" />
      ) : items.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-resolved/8 px-4 py-3 text-sm text-resolved"><CircleCheck size={16} aria-hidden /> Nothing to review. Every recent fix looked genuine.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-ink/10 p-3 animate-rise">
              <div className="flex gap-1.5">
                {[item.before, item.after].map((src, k) => (
                  <div key={k} className="relative size-20 overflow-hidden rounded-xl bg-ink/5">
                    {src && <img src={src} alt={k ? "Proof photo" : "Citizen photo"} className="size-full object-cover" />}
                    <span className={`absolute bottom-1 left-1 rounded-full px-1.5 text-[10px] font-semibold text-white ${k ? "bg-resolved" : "bg-alert"}`}>{k ? "After" : "Before"}</span>
                  </div>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <Link to={`/issues/${item.id}`} className="font-semibold hover:text-accent">{issueLabel(item)} <span className="font-normal text-ink/45">{item.ticket}</span></Link>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-marker-dark">
                  {item.fixCheck.verdict === "still_visible" ? <TriangleAlert size={14} aria-hidden /> : <MapPinOff size={14} aria-hidden />}
                  {item.fixCheck.verdict === "still_visible" ? "Problem may still be visible" : "May be a different place"}
                  {item.fixCheck.similarity !== null && <span className="text-xs text-ink/50">· place match {Math.round(item.fixCheck.similarity * 100)}%</span>}
                </p>
                <p className="text-xs text-ink/50">{item.officer ?? "Officer"} · {timeAgo(item.fixCheck.at)}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={busy === item.id} onClick={() => decide(item, false)} className="btn btn-outline !px-3 !py-2 text-xs"><CircleCheck size={14} aria-hidden /> Looks fine</button>
                {item.status === "resolved" && (
                  <button type="button" disabled={busy === item.id} onClick={() => decide(item, true)} className="btn bg-alert !px-3 !py-2 text-xs text-white hover:brightness-110"><RotateCcw size={14} aria-hidden /> Reopen</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
