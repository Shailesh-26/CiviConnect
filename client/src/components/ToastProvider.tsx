import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { ToastContext, type ToastKind, type ToastOptions } from "../lib/toast-context";

type Toast = ToastOptions & { id: number; kind: ToastKind; message: string };

const STYLE = {
  success: { icon: CircleCheck, tile: "bg-resolved/15 text-resolved", bar: "bg-resolved", title: "Done" },
  error: { icon: CircleAlert, tile: "bg-alert/15 text-alert", bar: "bg-alert", title: "Something went wrong" },
  info: { icon: Info, tile: "bg-accent/15 text-accent", bar: "bg-accent", title: "Heads up" },
} as const;

// One toast. Hovering pauses its countdown so people can read or press the action.
function ToastCard({ toast, onClose }: { toast: Toast; onClose: (id: number) => void }) {
  const { icon: Icon, tile, bar, title } = STYLE[toast.kind];
  const duration = toast.duration ?? (toast.kind === "error" ? 7000 : toast.action ? 6500 : 4500);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration);
  const startedAt = useRef(0);

  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onClose(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, onClose, toast.id]);

  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto relative w-full max-w-[30rem] overflow-hidden rounded-2xl border border-ink/10 bg-surface/90 shadow-lift backdrop-blur-xl animate-pop"
    >
      <div className="flex items-start gap-3.5 p-4">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tile}`}>
          <Icon size={21} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="font-display text-[0.95rem] font-semibold leading-tight">{toast.title ?? title}</p>
          <p className="mt-1 text-sm text-ink/70">{toast.message}</p>
        </div>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action!.onClick();
              onClose(toast.id);
            }}
            className="btn btn-outline shrink-0 self-center !px-3 !py-1.5 text-sm"
          >
            {toast.action.label}
          </button>
        )}
        <button type="button" onClick={() => onClose(toast.id)} aria-label="Dismiss" className="grid size-7 shrink-0 place-items-center rounded-lg text-ink/45 hover:bg-ink/5 hover:text-ink">
          <X size={16} aria-hidden />
        </button>
      </div>
      <span
        className={`absolute bottom-0 left-0 h-1 w-full origin-left ${bar} cc-toast-timer`}
        style={{ animationDuration: `${duration}ms`, animationPlayState: paused ? "paused" : "running" }}
        aria-hidden
      />
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const push = useCallback((kind: ToastKind, message: string, options: ToastOptions = {}) => {
    const id = nextId.current++;
    setToasts((all) => [...all.slice(-2), { id, kind, message, ...options }]);
  }, []);

  const api = useMemo(
    () => ({
      success: (m: string, o?: ToastOptions) => push("success", m, o),
      error: (m: string, o?: ToastOptions) => push("error", m, o),
      info: (m: string, o?: ToastOptions) => push("info", m, o),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[3000] flex flex-col items-center gap-2.5 px-3 lg:bottom-6 lg:items-end lg:px-6">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
