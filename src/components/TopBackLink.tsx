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
      className="inline-block px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-wit-text no-underline text-sm font-medium hover:bg-white/15 transition-colors"
    >
      {label}
    </DevLink>
  );
}
