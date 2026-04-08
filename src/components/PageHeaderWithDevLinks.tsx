"use client";

import { DevLink } from "./DevLink";
import { LanguageToggle } from "./LanguageToggle";
import { useI18n } from "@/lib/i18n-context";

type PageHeaderWithDevLinksProps = {
  backLabel?: string;
};

/**
 * 共通ページヘッダー（devtj パラメータ維持）
 */
export function PageHeaderWithDevLinks({ backLabel }: PageHeaderWithDevLinksProps) {
  const { t } = useI18n();
  const label = backLabel ?? t("common.backToTopArrow");

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 py-8">
      <DevLink
        href="/"
        className="flex items-center gap-3 text-[28px] font-black tracking-[2px] text-[var(--color-text)] no-underline hover:opacity-90"
      >
        <span className="block h-8 w-8 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] shadow-[0_0_15px_var(--wit-accent-glow)]" />
        Wispo
      </DevLink>
      <div className="flex items-center gap-2 sm:gap-3">
        <LanguageToggle size="comfortable" />
        <DevLink
          href="/"
          className="text-[var(--color-muted)] text-sm no-underline hover:text-[var(--color-text)] transition-colors"
        >
          {label}
        </DevLink>
      </div>
    </header>
  );
}
