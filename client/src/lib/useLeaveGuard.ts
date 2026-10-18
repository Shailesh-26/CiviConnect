import { useCallback, useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";

// Logging out or being sent to the login page is never held back.
const ALWAYS_ALLOWED = ["/", "/login"];

// While `dirty` is true, moving to another page is paused so the page can ask
// "save or discard?", and closing the tab shows the browser's own warning.
// Call allowLeave() right before a navigation you start yourself (after saving or submitting).
export function useLeaveGuard(dirty: boolean) {
  const allowed = useRef(false);
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        dirty && !allowed.current && currentLocation.pathname !== nextLocation.pathname && !ALWAYS_ALLOWED.includes(nextLocation.pathname),
      [dirty],
    ),
  );

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const allowLeave = useCallback(() => {
    allowed.current = true;
  }, []);

  return { blocker, allowLeave };
}
