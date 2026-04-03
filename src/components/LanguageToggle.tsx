"use client";

import { useI18n } from "@/lib/i18n-context";

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className="flex shrink-0 items-center rounded-lg border border-white/15 bg-white/5 p-0.5 text-[11px] font-bold tracking-wide sm:text-xs"
      role="group"
      aria-label={t("common.languageAria")}
    >
      <button
        type="button"
        onClick={() => setLocale("ja")}
        className={`min-h-[36px] min-w-[2.5rem] rounded-md px-2.5 py-1.5 transition-colors touch-manipulation ${
          locale === "ja"
            ? "bg-sky-600 text-white shadow-sm"
            : "text-wit-muted hover:bg-white/10 hover:text-wit-text"
        }`}
      >
        JP
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`min-h-[36px] min-w-[2.5rem] rounded-md px-2.5 py-1.5 transition-colors touch-manipulation ${
          locale === "en"
            ? "bg-sky-600 text-white shadow-sm"
            : "text-wit-muted hover:bg-white/10 hover:text-wit-text"
        }`}
      >
        EN
      </button>
    </div>
  );
}
