"use client";

import { DevLink } from "./DevLink";
import { useI18n } from "@/lib/i18n-context";

/**
 * トップへ戻るボタン（devtj パラメータ維持）
 */
export function TopBackLink({ children }: { children?: React.ReactNode }) {
  const { t } = useI18n();
  const label = children ?? t("common.backToTop");

  return (
    <DevLink
      href="/"
      className="inline-block px-5 py-2.5 rounded-xl bg-[color-mix(in_srgb,var(--color-text)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-text)_20%,transparent)] text-[var(--color-text)] no-underline text-sm font-medium hover:bg-[color-mix(in_srgb,var(--color-text)_15%,transparent)] transition-colors"
    >
      {label}
    </DevLink>
  );
}
