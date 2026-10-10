// A small canvas confetti burst for real moments: a report submitted, an issue fixed.
const COLORS = ["#eb6834", "#2a78d6", "#1baf7a", "#eda100", "#6250d6", "#e87ba4"];

export function confetti({ x = 0.5, y = 0.35, count = 140 }: { x?: number; y?: number; count?: number } = {}) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:4000";
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const ox = window.innerWidth * x;
  const oy = window.innerHeight * y;
  const parts = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    return {
      x: ox, y: oy,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 6,
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 4,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  });

  const start = performance.now();
  const frame = (t: number) => {
    const age = t - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age / 2200);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (age < 2300) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
