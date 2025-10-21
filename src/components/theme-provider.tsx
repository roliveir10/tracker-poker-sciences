"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type Theme = "light" | "dark";

type ThemePreferenceSource = "user";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (value: Theme) => void;
  initialized: boolean;
  preferenceSource: ThemePreferenceSource;
  setPreferenceSource: Dispatch<SetStateAction<ThemePreferenceSource>>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_STORAGE_KEY = "theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [preferenceSource, setPreferenceSource] =
    useState<ThemePreferenceSource>("user");
  const [initialized, setInitialized] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    }
  }, [theme, initialized, preferenceSource]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: (value) => {
        setPreferenceSource("user");
        setInitialized(true);
        setTheme(value);
      },
      initialized,
      preferenceSource,
      setPreferenceSource,
    }),
    [theme, initialized, preferenceSource, setPreferenceSource],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (context === null) {
    throw new Error("useTheme doit être utilisé à l'intérieur d'un ThemeProvider");
  }

  return context;
}
