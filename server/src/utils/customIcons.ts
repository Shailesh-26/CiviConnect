// Icons a citizen can pick for an "Other" problem. Keep this list in sync with
// client/src/lib/customIcons.ts (same keys, same order).
export const CUSTOM_ICON_KEYS = [
  "circle-help", "signpost", "milestone", "footprints", "triangle-alert", "traffic-cone", "construction",
  "fence", "car", "bus", "bike", "parking-meter", "building-2", "house", "store", "school", "hospital",
  "landmark", "trees", "shrub", "flower-2", "dog", "bird", "bug", "rat", "droplet", "waves", "flame",
  "wind", "zap", "plug", "cable", "volume-2", "megaphone", "recycle", "toilet", "armchair", "spray-can",
  "cctv", "siren", "accessibility", "baby",
] as const;

export type CustomIconKey = (typeof CUSTOM_ICON_KEYS)[number];

// "Open  Manhole!" and "open manhole" are the same problem for merging purposes.
export function normaliseLabel(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-෿]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
