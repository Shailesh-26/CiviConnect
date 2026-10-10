// A made-up city plan for the login/register backdrop: blocks, parks, a lake, roads and pins.
// Generated once with a fixed seed so it looks the same on every visit.

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Block = { x: number; y: number; w: number; h: number; kind: "building" | "park" };
export type BackdropPin = { x: number; y: number; color: string; resolved: boolean; delay: number };

const XS = [0, 150, 310, 450, 620, 770, 930, 1080, 1240, 1390, 1540, 1700];
const YS = [0, 120, 250, 380, 530, 660, 800, 940, 1080];
const GAP = 14;

const rand = rng(41);

const ALL_BLOCKS: Block[] = [];
for (let r = 0; r < YS.length - 1; r++) {
  for (let c = 0; c < XS.length - 1; c++) {
    const x = XS[c] + GAP;
    const y = YS[r] + GAP;
    const w = XS[c + 1] - XS[c] - GAP * 2;
    const h = YS[r + 1] - YS[r] - GAP * 2;
    const park = rand() < 0.12;
    if (!park && rand() < 0.5) {
      // Split some blocks into two buildings for a less regular look.
      const split = 0.35 + rand() * 0.3;
      const vertical = w > h;
      if (vertical) {
        ALL_BLOCKS.push({ x, y, w: w * split - 5, h, kind: "building" }, { x: x + w * split + 5, y, w: w * (1 - split) - 5, h, kind: "building" });
      } else {
        ALL_BLOCKS.push({ x, y, w, h: h * split - 5, kind: "building" }, { x, y: y + h * split + 5, w, h: h * (1 - split) - 5, kind: "building" });
      }
    } else {
      ALL_BLOCKS.push({ x, y, w, h, kind: park ? "park" : "building" });
    }
  }
}

// Leave room for the lake (drawn below) so buildings do not sit in the water.
const inLake = (b: Block) => b.x + b.w > 1160 && b.x < 1430 && b.y + b.h > 740 && b.y < 920;
export const BLOCKS = ALL_BLOCKS.filter((b) => !inLake(b));

// Two arterial roads that cut across the grid, like real Indian city ring and radial roads.
export const ARTERIALS = [
  "M-40 700 C 260 640 420 760 700 600 S 1150 330 1740 380",
  "M380 -40 C 420 220 560 360 620 520 S 760 860 900 1140",
];

export const LAKE = "M1180 760 c60 -50 190 -40 230 20 c40 60 -20 130 -110 140 c-90 10 -170 -100 -120 -160z";

const PIN_COLORS = ["#c2561f", "#4f7d3a", "#2a7f9e", "#c99700", "#6b4a8f", "#5b6b7a"];

export const PINS: BackdropPin[] = Array.from({ length: 16 }, (_, i) => {
  const c = 1 + Math.floor(rand() * (XS.length - 3));
  const r = Math.floor(rand() * (YS.length - 1));
  return {
    x: XS[c] + (rand() < 0.5 ? 0 : (XS[c + 1] - XS[c]) / 2),
    y: YS[r] + 40 + rand() * 60,
    color: PIN_COLORS[i % PIN_COLORS.length],
    resolved: rand() < 0.3,
    delay: i * 0.85,
  };
});
