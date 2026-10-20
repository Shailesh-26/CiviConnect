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
    // After the server comes back, reload once so the page isn't showing stale numbers.
    window.addEventListener("cc:back-online", later);
    const every = window.setInterval(() => fn.current(), fallbackMs);
    return () => {
      off();
      window.removeEventListener("cc:back-online", later);
      window.clearInterval(every);
      window.clearTimeout(timer);
    };
  }, [subscribe, fallbackMs]);
}
