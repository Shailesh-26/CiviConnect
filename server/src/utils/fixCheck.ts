import type { Category } from "../models/Issue";

/**
 * The AI fix check, as a pure function so it can be tested.
 *
 * When an officer marks an issue fixed, the proof photo is compared with the citizens' photos:
 *  - same place?   cosine similarity of the CLIP embeddings (the scene: road, buildings, trees...)
 *  - still there?  the category classifier looks at the proof photo; if it still clearly sees the
 *                  same problem, the fix may not be real
 * It is advisory: it never changes the status, it only alerts admins and shows a note on the issue.
 */
export const SAME_PLACE_MIN = 0.72;
export const STILL_VISIBLE_MIN = 0.8;

export type FixVerdict = "looks_fixed" | "different_place" | "still_visible";

export type FixInput = {
  issueCategory: Category;
  // Highest similarity between the proof photo and any report photo; null when there was nothing to compare with.
  similarity: number | null;
  proofTop: { category: string; score: number } | null;
  proofCivic: number;
};

export function fixVerdict({ issueCategory, similarity, proofTop, proofCivic }: FixInput): FixVerdict {
  const stillVisible = Boolean(proofTop && proofTop.category === issueCategory && proofTop.score >= STILL_VISIBLE_MIN && proofCivic >= 0.5);
  if (stillVisible) return "still_visible";
  if (similarity !== null && similarity < SAME_PLACE_MIN) return "different_place";
  return "looks_fixed";
}
