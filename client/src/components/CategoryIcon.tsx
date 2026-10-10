import { createElement } from "react";
import { categoryMeta } from "../lib/constants";
import { customIconFor } from "../lib/customIcons";
import type { Category } from "../types";

// `icon` is the custom icon key an "Other" problem was given, if any.
export function CategoryIcon({ category, icon, size = 20 }: { category: Category; icon?: string | null; size?: number }) {
  const Icon = (category === "other" && customIconFor(icon)) || categoryMeta(category).icon;
  return createElement(Icon, { size, "aria-hidden": true });
}
