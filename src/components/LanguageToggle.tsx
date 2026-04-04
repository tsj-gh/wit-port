"use client";

import { useI18n } from "@/lib/i18n-context";

type LanguageToggleProps = {
  /**
   * compact: h-8（■Wispo アイコンと同じ・ゲームヘッダー向け）
   * comfortable: h-10（トップに近い大きめロゴ横）
   */
  size?: "compact" | "comfortable";
};

export function LanguageToggle({ size = "compact" }: LanguageToggleProps) {
  const { locale, setLocale, t } = useI18n();
  const h = size === "comfortable" ? "h-10 sm:h-11" : "h-8 sm:h-9";

  return (
    <div
      className={`flex ${h} shrink-0 items-stretch rounded-lg border border-white/15 bg-white/5 p-0 text-[10px] font-bold tracking-wide sm:text-[11px]`}
      role="group"
      aria-label={t("common.languageAria")}
    >
      <button
        type="button"
        onClick={() => setLocale("ja")}
        className={`flex min-h-0 min-w-[2rem] flex-1 items-center justify-center rounded-md px-2 transition-colors touch-manipulation sm:min-w-[2.25rem] ${
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
        className={`flex min-h-0 min-w-[2rem] flex-1 items-center justify-center rounded-md px-2 transition-colors touch-manipulation sm:min-w-[2.25rem] ${
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
