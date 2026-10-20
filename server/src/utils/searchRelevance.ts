import { cosine } from "./vectors";

// Tuned on real scores from the demo city (see test "photo search on real scores for garbage").
// CLIP gives every photo some similarity to any sentence, so "the 24 closest" always fills up even
// when only three photos really match. Two checks decide what counts as a match:
//  1. Rivals: the photo must look more like the search words than like any OTHER kind of civic
//     problem (a broken street light with litter around it is closer to "a broken street light"
//     than to "garbage"). This compares scores with each other, so it needs no tuned threshold.
//  2. Closeness: it must also be near the best match and above a small floor.
export const SEARCH_MIN_SCORE = 0.21;
export const SEARCH_MARGIN = 0.08;
export const RIVAL_SLACK = 0.005;
export const SAME_MEANING = 0.9;
const LOOSER_MAX = 12;

export const RIVALS = [
  { key: "pothole", text: "a pothole in the road" },
  { key: "drainage", text: "a blocked drain or a flooded street" },
  { key: "garbage", text: "a pile of garbage and litter" },
  { key: "fallen_tree", text: "a fallen tree blocking a road" },
  { key: "streetlight", text: "a broken street light pole" },
  { key: "footpath", text: "a broken footpath or pavement" },
] as const;

export type Rival = { key: string; vector: number[] };

// Rivals that mean the same as the search words are dropped (always the closest one, plus any
// near-identical ones), otherwise a garbage photo would "lose" to "a pile of garbage".
export function pickRivals(query: number[], rivals: Rival[]): Rival[] {
  if (rivals.length === 0) return [];
  const sims = rivals.map((r) => cosine(query, r.vector));
  const closest = sims.indexOf(Math.max(...sims));
  return rivals.filter((_, i) => i !== closest && sims[i] < SAME_MEANING);
}

export function strongestRival(photo: number[], rivals: Rival[]): { key: string; score: number } | null {
  let best: { key: string; score: number } | null = null;
  for (const r of rivals) {
    const score = cosine(photo, r.vector);
    if (!best || score > best.score) best = { key: r.key, score };
  }
  return best;
}

export function splitByRelevance<T>(ranked: T[], score: (x: T) => number, limit: number, beatsRivals: (x: T) => boolean = () => true) {
  const candidates = ranked.filter(beatsRivals);
  if (candidates.length === 0) return { strong: [] as T[], looser: ranked.filter((x) => score(x) >= SEARCH_MIN_SCORE - 0.03).slice(0, LOOSER_MAX) };
  const cutoff = Math.max(SEARCH_MIN_SCORE, score(candidates[0]) - SEARCH_MARGIN);
  const strong = candidates.filter((x) => score(x) >= cutoff).slice(0, limit);
  const inStrong = new Set(strong);
  const looser = ranked.filter((x) => !inStrong.has(x) && score(x) >= SEARCH_MIN_SCORE - 0.03).slice(0, LOOSER_MAX);
  return { strong, looser };
}
