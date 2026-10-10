import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Flag, X } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { FLAG_REASONS } from "../lib/community";
import { useToast } from "../lib/toast-context";
import type { FlagReason } from "../types";

type Props = {
  open: boolean;
  // "/issues/<id>/flag" or "/comments/<id>/flag"
  endpoint: string;
  what: "issue" | "comment";
  onClose: () => void;
  onDone: () => void;
};

// Ask why something should be reviewed by an admin, then send the flag.
export function FlagDialog({ open, endpoint, what, onClose, onDone }: Props) {
  const toast = useToast();
  const titleId = useId();
  const [reason, setReason] = useState<FlagReason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  async function submit() {
    if (!reason) return;
    setBusy(true);
    try {
      await api(endpoint, { method: "POST", body: { reason, note: note.trim() || undefined } });
      toast.success("An admin will take a look. Thank you for keeping the board honest.", { title: "Report sent" });
      setReason("");
      setNote("");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send the report. Try again.");
      if (err instanceof ApiError && err.status === 409) onDone();
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[2500] grid place-items-end p-0 sm:place-items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade" onClick={busy ? undefined : onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="card relative w-full max-w-md rounded-b-none p-5 shadow-lift animate-rise sm:rounded-b-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-alert/12 text-alert"><Flag size={19} aria-hidden /></span>
            <div>
              <h2 id={titleId} className="text-lg font-semibold">Report this {what}</h2>
              <p className="text-xs text-ink/55">Only admins see reports. The author is not told who sent it.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg text-ink/50 hover:bg-ink/5"><X size={17} aria-hidden /></button>
        </div>
        <div className="mt-4 space-y-1.5" role="radiogroup" aria-label="Reason">
          {FLAG_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={reason === r.value}
              onClick={() => setReason(r.value)}
              className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${reason === r.value ? "border-alert bg-alert/8" : "border-ink/10 hover:border-ink/30"}`}
            >
              <span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2 ${reason === r.value ? "border-alert" : "border-ink/30"}`}>
                {reason === r.value && <span className="size-2 rounded-full bg-alert" />}
              </span>
              <span>
                <span className="block text-sm font-medium">{r.label}</span>
                <span className="block text-xs text-ink/55">{r.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} placeholder="Anything the admin should know? (optional)" className="input mt-3 text-sm" />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-outline">Cancel</button>
          <button type="button" onClick={submit} disabled={busy || !reason} className="btn bg-alert text-white hover:brightness-110">{busy ? "Sending…" : "Send report"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
