// Very small text similarity for duplicate hints: share of meaningful words two texts have in common.
const STOP = new Set(
  "a an the is are was were be been of in on at to for from and or but with near this that it its there here very not no has have had my our your their please since".split(" "),
);

export function words(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

// Jaccard similarity between 0 (nothing shared) and 1 (same words).
export function similarity(a: string, b: string) {
  const x = words(a);
  const y = words(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / (x.size + y.size - shared);
}
