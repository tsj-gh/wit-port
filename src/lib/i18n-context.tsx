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
import ja from "../../locales/ja.json";
import en from "../../locales/en.json";
import {
  DEFAULT_LOCALE,
  type Locale,
  WISPO_LOCALE_COOKIE,
  WISPO_LOCALE_STORAGE_KEY,
} from "./i18n-constants";

const messages: Record<Locale, Record<string, unknown>> = {
  ja: ja as Record<string, unknown>,
  en: en as Record<string, unknown>,
};

function readCookieLocale(): Locale | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${WISPO_LOCALE_COOKIE}=([^;]*)`));
  const v = m?.[1]?.trim();
  return v === "en" ? "en" : v === "ja" ? "ja" : null;
}

function getByPath(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const fromCookie = readCookieLocale();
    const fromLs =
      typeof localStorage !== "undefined" ? localStorage.getItem(WISPO_LOCALE_STORAGE_KEY) : null;
    const raw = fromCookie ?? fromLs;
    if (raw === "en" || raw === "ja") {
      setLocaleState(raw);
    }
    document.documentElement.lang = raw === "en" ? "en" : "ja";
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(WISPO_LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    document.cookie = `${WISPO_LOCALE_COOKIE}=${next};path=/;max-age=31536000;SameSite=Lax`;
    document.documentElement.lang = next === "en" ? "en" : "ja";
  }, []);

  const t = useCallback(
    (key: string) => {
      const v = getByPath(messages[locale], key);
      if (v != null) return v;
      const fallback = getByPath(messages[DEFAULT_LOCALE], key);
      return fallback ?? key;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
