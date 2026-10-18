import { createElement, use, type ComponentType } from "react";

// Like React.lazy, but once the page's code has been downloaded (for example by the background
// preload) it renders straight away, so there's no loading placeholder or flicker when you move between pages.
export function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  let Loaded: ComponentType | null = null;
  let pending: Promise<unknown> | null = null;
  const preload = () =>
    (pending ??= load().then(
      (m) => {
        Loaded = m.default;
      },
      (err) => {
        pending = null; // a failed download (offline) can be retried on the next visit
        throw err;
      },
    ));

  function Page() {
    if (!Loaded) use(preload());
    return createElement(Loaded as ComponentType);
  }
  return { Page, preload };
}
