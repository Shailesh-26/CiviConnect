import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FilePen } from "lucide-react";
import type { Blocker } from "react-router-dom";

type Props = {
  blocker: Blocker;
  title?: string;
  message: string;
  discardLabel?: string;
  // When given, a "Save and leave" button appears. Return true if saving worked.
  onSave?: () => Promise<boolean>;
};

// Asked when someone tries to leave a page that has unsaved changes.
export function UnsavedChangesDialog({ blocker, title = "Leave without saving?", message, discardLabel = "Discard changes", onSave }: Props) {
  const titleId = useId();
  const stayRef = useRef<HTMLButtonElement>(null);
  const [saving, setSaving] = useState(false);
  const open = blocker.state === "blocked";

  useEffect(() => {
    if (!open) return;
    stayRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") blocker.reset?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, blocker]);

  if (!open) return null;

  async function saveAndLeave() {
    if (!onSave) return;
    setSaving(true);
    const ok = await onSave();
    setSaving(false);
    if (ok) blocker.proceed?.();
    else blocker.reset?.();
  }

  return createPortal(
    <div className="fixed inset-0 z-[2500] grid place-items-center p-4" role="presentation">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade" onClick={saving ? undefined : () => blocker.reset?.()} aria-hidden />
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="card relative w-full max-w-lg p-6 shadow-lift animate-pop">
        <span className="grid size-12 place-items-center rounded-2xl bg-marker/20 text-marker-dark"><FilePen size={22} aria-hidden /></span>
        <h2 id={titleId} className="mt-4 text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-ink/65">{message}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={stayRef} type="button" onClick={() => blocker.reset?.()} disabled={saving} className="btn btn-ghost whitespace-nowrap">Keep editing</button>
          <button type="button" onClick={() => blocker.proceed?.()} disabled={saving} className="btn btn-outline whitespace-nowrap text-alert">{discardLabel}</button>
          {onSave && (
            <button type="button" onClick={saveAndLeave} disabled={saving} className="btn btn-primary whitespace-nowrap">{saving ? "Saving…" : "Save and leave"}</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
