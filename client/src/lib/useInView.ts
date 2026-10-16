import { useEffect, useState } from "react";

type Options = { once?: boolean; rootMargin?: string; threshold?: number };

// Tells a component when it is on screen, so animations only run while someone can see them.
// Returns a callback ref (pass it to `ref`) and the visibility flag.
export function useInView<T extends Element = HTMLDivElement>({ once = false, rootMargin = "0px", threshold = 0.15 }: Options = {}) {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin, threshold },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [node, once, rootMargin, threshold]);

  return [setNode, inView] as const;
}

// Runs `tick` every `ms` while `active` is true. Stops cleanly when the component leaves the screen.
export function useInterval(tick: () => void, ms: number, active = true) {
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(tick, ms);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, active]);
}
