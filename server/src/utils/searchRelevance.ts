// CLIP gives every photo some similarity to any sentence, so "the 24 closest" always fills up
// even when only three photos really match. A photo counts as a match when it is close to the best
// score AND above an absolute floor; the next few are returned separately as looser matches.
export const SEARCH_MIN_SCORE = 0.21;
export const SEARCH_MARGIN = 0.04;
const LOOSER_MAX = 12;

export function splitByRelevance<T>(ranked: T[], score: (x: T) => number, limit: number) {
  if (ranked.length === 0) return { strong: [] as T[], looser: [] as T[] };
  const cutoff = Math.max(SEARCH_MIN_SCORE, score(ranked[0]) - SEARCH_MARGIN);
  const strong = ranked.filter((x) => score(x) >= cutoff).slice(0, limit);
  const looser = ranked.slice(strong.length, strong.length + LOOSER_MAX).filter((x) => score(x) >= SEARCH_MIN_SCORE - 0.03);
  return { strong, looser };
}
