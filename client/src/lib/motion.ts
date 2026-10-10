// Global motion helpers: pointer spotlight, 3D tilt and scroll reveal. Installed once.

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function installMotion() {
  let tilted: HTMLElement | null = null;

  const onMove = (e: PointerEvent) => {
    const target = e.target as HTMLElement | null;
    const spot = target?.closest<HTMLElement>(".card-hover, .spot");
    if (spot) {
      const r = spot.getBoundingClientRect();
      spot.style.setProperty("--mx", `${e.clientX - r.left}px`);
      spot.style.setProperty("--my", `${e.clientY - r.top}px`);
    }
    if (reduced()) return;
    const tilt = target?.closest<HTMLElement>(".tilt") ?? null;
    if (tilted && tilted !== tilt) {
      tilted.style.setProperty("--rx", "0deg");
      tilted.style.setProperty("--ry", "0deg");
    }
    tilted = tilt;
    if (tilt) {
      const r = tilt.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.setProperty("--rx", `${(-y * 7).toFixed(2)}deg`);
      tilt.style.setProperty("--ry", `${(x * 9).toFixed(2)}deg`);
    }
  };
  const onLeave = () => {
    if (tilted) {
      tilted.style.setProperty("--rx", "0deg");
      tilted.style.setProperty("--ry", "0deg");
      tilted = null;
    }
  };
  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);

  // Reveal: watch every `.reveal` element, including ones added later.
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  const scan = (root: ParentNode) => root.querySelectorAll?.(".reveal:not(.is-in)").forEach((el) => io.observe(el));
  scan(document);
  const mo = new MutationObserver((records) => {
    for (const r of records) r.addedNodes.forEach((n) => n instanceof HTMLElement && (n.matches(".reveal") ? io.observe(n) : scan(n)));
  });
  mo.observe(document.body, { childList: true, subtree: true });

  return () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerleave", onLeave);
    io.disconnect();
    mo.disconnect();
  };
}
