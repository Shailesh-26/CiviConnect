import { createContext, useContext } from "react";

export type Theme = "light" | "dark";
export type ThemeState = { theme: Theme; toggle: () => void };

export const ThemeContext = createContext<ThemeState | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
