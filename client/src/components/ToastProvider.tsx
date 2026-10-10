import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { ToastContext, type ToastKind } from "../lib/toast-context";

type Toast = { id: number; kind: ToastKind; message: string };

const STYLE = {
  success: { icon: CircleCheck, bar: "bg-resolved", text: "text-resolved" },
  error: { icon: CircleAlert, bar: "bg-alert", text: "text-alert" },
  info: { icon: Info, bar: "bg-accent", text: "text-accent" },
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((all) => [...all.slice(-3), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 6000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (m: string) => push("success", m),
      error: (m: string) => push("error", m),
      info: (m: string) => push("info", m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[3000] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6">
        {toasts.map((t) => {
          const { icon: Icon, bar, text } = STYLE[t.kind];
          return (
            <div key={t.id} role="status" className="card pointer-events-auto relative flex w-full max-w-sm animate-pop items-start gap-3 overflow-hidden py-3 pl-5 pr-3 text-sm">
              <span className={`absolute inset-y-0 left-0 w-1.5 ${bar}`} aria-hidden />
              <Icon size={18} className={`mt-0.5 shrink-0 ${text}`} aria-hidden />
              <p className="flex-1">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="rounded p-0.5 text-ink/50 hover:text-ink">
                <X size={15} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
