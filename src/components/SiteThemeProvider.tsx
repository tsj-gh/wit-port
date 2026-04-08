"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { pickOnPrimaryForHex, SITE_THEMES, type SiteThemeId } from "@/lib/themes";

const STORAGE_KEY = "wispo-site-theme-id";

type SiteThemeContextValue = {
  themeId: SiteThemeId;
  setThemeId: (id: SiteThemeId) => void;
  theme: (typeof SITE_THEMES)[SiteThemeId];
};

const SiteThemeContext = createContext<SiteThemeContextValue | null>(null);

function applyThemeCssVars(theme: (typeof SITE_THEMES)[SiteThemeId]) {
  const root = document.documentElement;
  const { bg, surface, primary, text, accent } = theme.colors;
  root.style.setProperty("--color-bg", bg);
  root.style.setProperty("--color-surface", surface);
  root.style.setProperty("--color-primary", primary);
  root.style.setProperty("--color-text", text);
  root.style.setProperty("--color-accent", accent);
  root.style.setProperty("--color-muted", `color-mix(in srgb, ${text} 56%, ${bg})`);
  root.style.setProperty("--color-on-primary", pickOnPrimaryForHex(primary));
  root.style.setProperty("--wit-border", `color-mix(in srgb, ${text} 14%, transparent)`);
  root.style.setProperty(
    "--wit-card-bg",
    `color-mix(in srgb, ${surface} 82%, ${bg})`
  );
  root.style.setProperty(
    "--wit-accent-glow",
    `color-mix(in srgb, ${primary} 45%, transparent)`
  );
}

export function SiteThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<SiteThemeId>("paperCraft");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && raw in SITE_THEMES) setThemeIdState(raw as SiteThemeId);
    } catch {
      /* ignore */
    }
  }, []);

  const setThemeId = useCallback((id: SiteThemeId) => {
    setThemeIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const theme = SITE_THEMES[themeId];

  useEffect(() => {
    applyThemeCssVars(theme);
  }, [theme]);

  const value = useMemo(
    () => ({ themeId, setThemeId, theme }),
    [themeId, setThemeId, theme]
  );

  return <SiteThemeContext.Provider value={value}>{children}</SiteThemeContext.Provider>;
}

export function useSiteTheme(): SiteThemeContextValue {
  const ctx = useContext(SiteThemeContext);
  if (!ctx) throw new Error("useSiteTheme must be used within SiteThemeProvider");
  return ctx;
}
