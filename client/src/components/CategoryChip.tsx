import { CATEGORY_COLOR } from "../lib/constants";
import type { Category } from "../types";
import { CategoryIcon } from "./CategoryIcon";

// A rounded tile in the category's own colour, used wherever an issue needs a recognisable icon.
export function CategoryChip({ category, icon, size = "md" }: { category: Category; icon?: string | null; size?: "sm" | "md" | "lg" }) {
  const color = CATEGORY_COLOR[category];
  const box = size === "lg" ? "size-14 rounded-2xl" : size === "sm" ? "size-9 rounded-lg" : "size-12 rounded-xl";
  return (
    <span className={`grid shrink-0 place-items-center ${box}`} style={{ background: `${color}22`, color }}>
      <CategoryIcon category={category} icon={icon} size={size === "lg" ? 26 : size === "sm" ? 17 : 22} />
    </span>
  );
}
