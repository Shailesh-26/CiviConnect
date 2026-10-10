import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

export type MenuItem = { label: string; icon: LucideIcon; onSelect: () => void; danger?: boolean; hidden?: boolean };

type Spot = { top: number; left?: number; right?: number; upward: boolean };

// The "three dots" menu that gathers the less frequent actions on a thread.
// The list is drawn in a portal so cards around it can never cover it.
export function ActionMenu({ items, label = "More actions", align = "right" }: { items: MenuItem[]; label?: string; align?: "left" | "right" }) {
  const [spot, setSpot] = useState<Spot | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const visible = items.filter((i) => !i.hidden);

  function toggle() {
    if (spot) {
      setSpot(null);
      return;
    }
    const r = button.current!.getBoundingClientRect();
    const upward = window.innerHeight - r.bottom < visible.length * 46 + 24;
    setSpot({
      top: upward ? r.top - 6 : r.bottom + 6,
      upward,
      ...(align === "right" ? { right: window.innerWidth - r.right } : { left: r.left }),
    });
  }

  useEffect(() => {
    if (!spot) return;
    const close = () => setSpot(null);
    // Close when the page really scrolls the button away, not on stray scroll events.
    const startTop = button.current?.getBoundingClientRect().top ?? 0;
    const onScroll = () => {
      const now = button.current?.getBoundingClientRect().top ?? 0;
      if (Math.abs(now - startTop) > 8) close();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!list.current?.contains(t) && !button.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [spot]);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={button}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          toggle();
        }}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={Boolean(spot)}
        className="grid size-9 place-items-center rounded-xl text-ink/55 transition hover:bg-ink/6 hover:text-ink"
      >
        <MoreHorizontal size={19} aria-hidden />
      </button>
      {spot &&
        createPortal(
          <div
            ref={list}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{ top: spot.top, left: spot.left, right: spot.right, transform: spot.upward ? "translateY(-100%)" : undefined }}
            className="fixed z-[2400] w-60 overflow-hidden rounded-2xl border border-ink/10 bg-surface/95 p-1.5 shadow-lift backdrop-blur-xl animate-fade"
          >
            {visible.map(({ label: text, icon: Icon, onSelect, danger }) => (
              <button
                key={text}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.preventDefault();
                  setSpot(null);
                  onSelect();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${danger ? "text-alert hover:bg-alert/10" : "text-ink/80 hover:bg-ink/6 hover:text-ink"}`}
              >
                <Icon size={17} aria-hidden /> {text}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
