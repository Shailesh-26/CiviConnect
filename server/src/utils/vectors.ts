// Small helpers for embedding vectors (lists of numbers from the Photo Assistant).

// Cosine similarity: 1 means the same direction (very similar photos), 0 means unrelated.
export function cosine(a: readonly number[], b: readonly number[]) {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// A vector sent by a browser is untrusted: it must be a list of finite numbers of a sensible length.
export function parseVector(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length < 16 || value.length > 2048) return null;
  const out = value.map(Number);
  return out.every(Number.isFinite) ? out : null;
}

export const round = (n: number, places = 3) => Math.round(n * 10 ** places) / 10 ** places;
