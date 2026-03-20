"use client";

import { DevLink } from "./DevLink";

type PageHeaderWithDevLinksProps = {
  backLabel?: string;
};

/**
 * 共通ページヘッダー（devtj パラメータ維持）
 */
export function PageHeaderWithDevLinks({ backLabel = "← トップへ戻る" }: PageHeaderWithDevLinksProps) {
  return (
    <header className="flex justify-between items-center py-8">
      <DevLink
        href="/"
        className="flex items-center gap-3 text-[28px] font-black tracking-[2px] text-wit-text no-underline hover:opacity-90"
      >
        <span className="block w-8 h-8 rounded-lg bg-gradient-to-br from-wit-accent to-purple-500 shadow-[0_0_15px_var(--wit-accent-glow)]" />
        Wispo
      </DevLink>
      <DevLink
        href="/"
        className="text-wit-muted text-sm no-underline hover:text-wit-text transition-colors"
      >
        {backLabel}
      </DevLink>
    </header>
  );
}
