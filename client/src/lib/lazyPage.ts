import { createElement, use, type ComponentType } from "react";

type Tracked<T> = Promise<T> & { status?: "fulfilled" | "rejected"; value?: T; reason?: unknown };

// Like React.lazy, but once the page's code has been downloaded (for example by the background
// preload) it renders straight away, so there's no loading placeholder or flicker when you move between pages.
export function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  let pending: Tracked<ComponentType> | null = null;
  const preload = () => {
    if (!pending) {
      const p: Tracked<ComponentType> = load().then((m) => m.default);
      // Marking the promise as settled lets React's use() read it synchronously next time.
      p.then(
        (value) => {
          p.status = "fulfilled";
          p.value = value;
        },
        (reason) => {
          p.status = "rejected";
          p.reason = reason;
          pending = null; // a failed download (offline) can be retried on the next visit
        },
      );
      pending = p;
    }
    return pending;
  };

  function Page() {
    const Loaded = use(preload() as Promise<ComponentType>);
    return createElement(Loaded);
  }
  return { Page, preload };
}
