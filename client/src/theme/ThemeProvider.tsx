import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ThemeContext, type Theme } from "./theme-context";

const initialTheme = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light");

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("cc-theme", next);
    } catch {
      // Storage can be blocked; the theme still changes for this visit.
    }
    setTheme(next);
  }, [theme]);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
