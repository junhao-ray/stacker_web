"use client";

import * as React from "react";

import {
  THEME_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
  isThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  mounted: boolean;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  theme: ThemePreference;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemePreference | null {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(storedTheme) ? storedTheme : null;
  } catch {
    return null;
  }
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(THEME_MEDIA_QUERY).matches ? "dark" : "light";
}

function applyTheme(theme: ThemePreference): ResolvedTheme {
  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;
  const root = document.documentElement;

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.theme = theme;
  root.dataset.resolvedTheme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;

  return resolvedTheme;
}

export function ThemeProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [theme, setThemeState] = React.useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>("light");
  const [mounted, setMounted] = React.useState(false);

  const setTheme = React.useCallback((nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
    setResolvedTheme(applyTheme(nextTheme));

    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage failures and keep the in-memory theme active.
    }
  }, []);

  React.useEffect(() => {
    const datasetTheme = document.documentElement.dataset.theme ?? null;
    const initialTheme =
      isThemePreference(datasetTheme)
        ? datasetTheme
        : readStoredTheme() ?? "system";

    setThemeState(initialTheme);
    setResolvedTheme(applyTheme(initialTheme));
    setMounted(true);

    const mediaQuery = window.matchMedia(THEME_MEDIA_QUERY);
    const handleSystemThemeChange = () => {
      if (document.documentElement.dataset.theme === "system") {
        setResolvedTheme(applyTheme("system"));
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      mounted,
      resolvedTheme,
      setTheme,
      theme,
    }),
    [mounted, resolvedTheme, setTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider.");
  }

  return context;
}
