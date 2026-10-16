import { useState } from "react";
import { ChevronsLeftRight } from "lucide-react";
import { RoadArt } from "./RoadArt";

// Drag (or use arrow keys) to compare the citizen's photo with the officer's proof photo.
export function ProofSlider() {
  const [pos, setPos] = useState(55);
  const [touched, setTouched] = useState(false);

  return (
    <div className={`relative overflow-hidden rounded-2xl select-none ${touched ? "" : "cc-hint-slide"}`} style={{ "--pos": `${pos}%` } as React.CSSProperties}>
      <RoadArt fixed className="block aspect-[16/10] w-full" />
      <div className="absolute inset-0 [clip-path:inset(0_calc(100%-var(--pos))_0_0)]">
        <RoadArt className="block h-full w-full" />
      </div>
      <span className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">Before</span>
      <span className="absolute right-2.5 top-2.5 rounded-full bg-resolved px-2.5 py-1 text-[11px] font-semibold text-white">After · proof</span>
      <div className="pointer-events-none absolute inset-y-0 left-[var(--pos)] w-0.5 -translate-x-1/2 bg-white shadow-[0_0_12px_rgba(0,0,0,.4)]">
        <span className="absolute left-1/2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[#17202b] shadow-lift">
          <ChevronsLeftRight size={18} aria-hidden />
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => {
          setTouched(true);
          setPos(Number(e.target.value));
        }}
        onPointerDown={() => setTouched(true)}
        aria-label="Compare before and after photos"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
