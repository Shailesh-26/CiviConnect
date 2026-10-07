import { categoryMeta } from "../lib/constants";
import type { Category } from "../types";

export function CategoryIcon({ category, size = 20 }: { category: Category; size?: number }) {
  const { icon: Icon } = categoryMeta(category);
  return <Icon size={size} aria-hidden />;
}
