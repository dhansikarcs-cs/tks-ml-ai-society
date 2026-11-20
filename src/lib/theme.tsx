"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_KEY } from "./theme-script";

export type Theme = "dark" | "light";

type ThemeContextValue = { theme: Theme; toggle: () => void; setTheme: (theme: Theme) => void };
const ThemeContext = createContext<ThemeContextValue>({ theme: "dark", toggle: () => {}, setTheme: () => {} });

function readStoredTheme(): Theme {
  if (typeof document !== "undefined") {
    const current = document.documentElement.dataset.theme;
    if (current === "light" || current === "dark") return current;
  }
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_KEY);
  return stored === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    setThemeState(readStoredTheme());
  }, []);

  function apply(next: Theme) {
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    window.localStorage.setItem(THEME_KEY, next);
  }

  function setTheme(next: Theme) {
    setThemeState(next);
    apply(next);
  }

  function toggle() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const light = theme === "light";
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggle}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      title={light ? "Switch to dark mode" : "Switch to light mode"}
    >
      {light ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
}