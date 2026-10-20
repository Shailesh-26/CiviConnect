import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, WifiOff } from "lucide-react";
import { isOffline, onConnectionChange, reportReachable } from "../lib/connection";

// "Can't reach the server. Reconnecting…" at the top of every page while the server is down;
// checks every 3 seconds, then says "Back online" and lets pages reload their data.
export function ConnectionBanner() {
  const [state, setState] = useState<"ok" | "down" | "back">(() => (isOffline() ? "down" : "ok"));
  const [tries, setTries] = useState(0);

  useEffect(
    () =>
      onConnectionChange((offline) => {
        if (offline) setState("down");
        else {
          setState("back");
          window.dispatchEvent(new Event("cc:back-online"));
        }
      }),
    [],
  );

  useEffect(() => {
    if (state === "back") {
      const t = window.setTimeout(() => setState("ok"), 2500);
      return () => window.clearTimeout(t);
    }
    if (state !== "down") return;
    const t = window.setInterval(async () => {
      setTries((n) => n + 1);
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (res.ok) reportReachable(true);
      } catch {
        // still down
      }
    }, 3000);
    return () => window.clearInterval(t);
  }, [state]);

  if (state === "ok") return null;
  const down = state === "down";
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[3000] flex justify-center px-3">
      <div className={`pointer-events-auto flex items-center gap-2.5 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lift animate-pop ${down ? "bg-ink" : "bg-resolved"}`}>
        {down ? <WifiOff size={16} aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}
        {down ? (
          <>
            Can't reach the server. Reconnecting
            <Loader2 size={15} className="animate-spin opacity-80" aria-hidden />
            {tries > 3 && <span className="hidden text-xs font-normal opacity-70 sm:inline">· your work on this page is kept</span>}
          </>
        ) : (
          "Back online"
        )}
      </div>
    </div>
  );
}
