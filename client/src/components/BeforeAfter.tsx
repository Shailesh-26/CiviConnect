import { useRef, useState, type PointerEvent } from "react";
import { MoveHorizontal } from "lucide-react";

// Drag the handle (or use the arrow keys) to compare the reported photo with the proof of the fix.
export function BeforeAfter({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const move = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  const down = (e: PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    move(e.clientX);
  };

  return (
    <div
      ref={box}
      onPointerDown={down}
      onPointerMove={(e) => dragging.current && move(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      className="relative aspect-[16/10] w-full cursor-ew-resize select-none overflow-hidden rounded-2xl border border-ink/15 touch-none"
    >
      <img src={after} alt="After the fix" className="absolute inset-0 size-full object-cover" draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={before} alt="Before the fix" className="size-full object-cover" draggable={false} />
      </div>
      <span className="absolute left-3 top-3 rounded-full bg-alert px-2.5 py-0.5 text-xs font-semibold text-white shadow">Before</span>
      <span className="absolute right-3 top-3 rounded-full bg-resolved px-2.5 py-0.5 text-xs font-semibold text-white shadow">After</span>
      <div className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_12px_rgb(0_0_0/0.4)]" style={{ left: `${pos}%` }}>
        <button
          type="button"
          role="slider"
          aria-label="Compare before and after"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
            if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
          }}
          className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-ink/60 text-white shadow-lift backdrop-blur"
        >
          <MoveHorizontal size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
