import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import { categoryMeta } from "./constants";
import { customIconFor } from "./customIcons";
import type { Category } from "../types";

// A teardrop map pin in a given colour with the category icon (or an "Other" problem's own icon) inside.
export function makePin(category: Category, color: string, size = 34, customIcon?: string | null) {
  const icon = (category === "other" && customIconFor(customIcon)) || categoryMeta(category).icon;
  const svg = renderToStaticMarkup(createElement(icon, { size: Math.round(size * 0.47), strokeWidth: 2.4 }));
  return L.divIcon({
    className: "cc-pin",
    html: `<div class="pin" style="background:${color};width:${size}px;height:${size}px"><span>${svg}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}
