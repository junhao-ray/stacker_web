export const THEME_STORAGE_KEY = "stacker-theme";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export const themeInitScript = `(() => {
  const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  const mediaQuery = ${JSON.stringify(THEME_MEDIA_QUERY)};

  const applyTheme = (theme) => {
    const resolvedTheme =
      theme === "system"
        ? window.matchMedia(mediaQuery).matches
          ? "dark"
          : "light"
        : theme;

    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.dataset.theme = theme;
    root.dataset.resolvedTheme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  };

  try {
    const storedTheme = localStorage.getItem(storageKey);
    const theme =
      storedTheme === "light" || storedTheme === "dark" || storedTheme === "system"
        ? storedTheme
        : "system";

    applyTheme(theme);
  } catch {
    applyTheme("system");
  }
})();`;
