import { useEffect, useRef } from "react";
import { useNotifications } from "./notification-context";

// Calls `reload` when the server says something changed (and every `fallbackMs` as a safety net).
export function useLiveRefresh(reload: () => void, fallbackMs = 60_000) {
  const { subscribe } = useNotifications();
  const fn = useRef(reload);
  useEffect(() => {
    fn.current = reload;
  });
  useEffect(() => {
    let timer: number | undefined;
    // Several events often arrive together; reload once.
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn.current(), 600);
    };
    const off = subscribe(later);
    const every = window.setInterval(() => fn.current(), fallbackMs);
    return () => {
      off();
      window.clearInterval(every);
      window.clearTimeout(timer);
    };
  }, [subscribe, fallbackMs]);
}
