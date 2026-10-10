import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  icon?: LucideIcon;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// A small modal that asks "are you sure?" before an action that cannot be taken back easily.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  icon: Icon,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Kept in refs so a parent re-render does not move the focus again.
  const cancelFn = useRef(onCancel);
  const busyRef = useRef(busy);
  useEffect(() => {
    cancelFn.current = onCancel;
    busyRef.current = busy;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) cancelFn.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2500] grid place-items-center p-4" role="presentation">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade" onClick={busy ? undefined : onCancel} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="card relative w-full max-w-sm p-6 shadow-lift animate-pop"
      >
        {Icon && (
          <span className={`grid size-12 place-items-center rounded-2xl ${tone === "danger" ? "bg-alert/12 text-alert" : "bg-accent/12 text-accent"}`}>
            <Icon size={22} aria-hidden />
          </span>
        )}
        <h2 id={titleId} className={`text-xl font-semibold ${Icon ? "mt-4" : ""}`}>{title}</h2>
        {message && <div className="mt-2 text-sm text-ink/65">{message}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="btn btn-outline">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`btn ${tone === "danger" ? "bg-alert text-white hover:brightness-110" : "btn-primary"}`}
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
