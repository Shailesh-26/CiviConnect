import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Hourglass, LogOut } from "lucide-react";
import { SIGNED_OUT_KEY } from "../auth/auth-context";
import { useAuth } from "../auth/useAuth";
import { api } from "../lib/api";
import { ACTIVITY_KEY, IDLE_LOGOUT_KEY, IDLE_MINUTES, unsavedWork, WARNING_SECONDS } from "../lib/idle";

const IDLE_MS = IDLE_MINUTES * 60_000;
const WARNING_MS = WARNING_SECONDS * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "wheel", "scroll"] as const;

const readShared = () => {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
};
const writeShared = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage blocked: this tab still times out on its own */
  }
};

// Watches for inactivity while someone is logged in (any role).
export function IdleGuard() {
  const { user } = useAuth();
  return user ? <IdleWatch key={user.id} /> : null;
}

function IdleWatch() {
  const { logout } = useAuth();
  const titleId = useId();
  const stayRef = useRef<HTMLButtonElement>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const lastActive = useRef(0);
  const lastPing = useRef(0);
  const warning = useRef(false);
  const ending = useRef(false);

  const endSession = useCallback(
    (tellOtherTabs: boolean) => {
      if (ending.current) return;
      ending.current = true;
      try {
        sessionStorage.setItem(SIGNED_OUT_KEY, `No activity for ${IDLE_MINUTES} minutes`);
      } catch {
        /* the login page simply shows no reason */
      }
      if (tellOtherTabs) writeShared(IDLE_LOGOUT_KEY, Date.now());
      void logout().catch(() => undefined);
    },
    [logout],
  );

  // Something happened in this tab. While the popup is up, only "Stay logged in" counts.
  const markActive = useCallback((fromButton = false) => {
    const now = Date.now();
    if (warning.current && !fromButton) return;
    if (!fromButton && now - lastActive.current < 1000) return;
    lastActive.current = now;
    if (fromButton || now - readShared() > 5000) writeShared(ACTIVITY_KEY, now);
    // Tell the server now and then, so its own inactivity limit knows this person is here.
    if (fromButton || now - lastPing.current > 60_000) {
      lastPing.current = now;
      api("/auth/ping", { method: "POST" }).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    lastActive.current = Date.now();
    lastPing.current = Date.now();
    writeShared(ACTIVITY_KEY, Date.now());
    const onActivity = () => markActive();
    for (const e of ACTIVITY_EVENTS) window.addEventListener(e, onActivity, { passive: true, capture: true });

    // Once a second: how long since anyone touched any tab? (Also catches a laptop waking from sleep.)
    const timer = window.setInterval(() => {
      const idleFor = Date.now() - Math.max(lastActive.current, readShared());
      if (idleFor >= IDLE_MS + WARNING_MS) {
        endSession(true);
      } else if (idleFor >= IDLE_MS) {
        if (!warning.current) setUnsaved(unsavedWork.count > 0);
        warning.current = true;
        setSecondsLeft(Math.ceil((IDLE_MS + WARNING_MS - idleFor) / 1000));
      } else if (warning.current) {
        // Someone used another tab: close the popup here too.
        warning.current = false;
        setSecondsLeft(null);
      }
    }, 1000);

    // Another tab logged out for inactivity: follow it.
    const onStorage = (e: StorageEvent) => {
      if (e.key === IDLE_LOGOUT_KEY && e.newValue) endSession(false);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, onActivity, { capture: true });
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, [markActive, endSession]);

  const open = secondsLeft !== null;
  useEffect(() => {
    if (open) stayRef.current?.focus();
  }, [open]);

  function stay() {
    warning.current = false;
    setSecondsLeft(null);
    markActive(true);
  }

  if (!open) return null;
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");
  return createPortal(
    <div className="fixed inset-0 z-[3000] grid place-items-center p-4" role="presentation">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-sm animate-fade" aria-hidden />
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={`${titleId}-d`} className="card relative w-full max-w-sm p-6 text-center shadow-lift animate-pop" onKeyDown={(e) => e.key === "Escape" && stay()}>
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-marker/20 text-marker-dark"><Hourglass size={26} aria-hidden /></span>
        <h2 id={titleId} className="mt-4 text-xl font-semibold">Are you still there?</h2>
        <p id={`${titleId}-d`} className="mt-2 text-sm text-ink/65">
          You haven't done anything for {IDLE_MINUTES} minutes. To keep your account safe, you'll be logged out in
        </p>
        <p className="mt-3 font-display text-4xl font-bold tabular-nums text-ink" aria-live="polite" aria-atomic="true">{mm}:{ss}</p>
        {unsaved && <p className="mt-3 rounded-xl bg-alert/10 px-3 py-2 text-sm text-alert">You have unsaved changes on this page. Stay logged in to keep them.</p>}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => endSession(true)} className="btn btn-outline"><LogOut size={16} aria-hidden /> Log out</button>
          <button ref={stayRef} type="button" onClick={stay} className="btn btn-primary">Stay logged in</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
