"use client";

import { Suspense } from "react";
import { DevLink } from "./DevLink";

function FooterNav() {
  return (
    <nav
      className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 mb-4"
      aria-label="フッターナビゲーション"
    >
      <DevLink
        href="/"
        className="text-[13px] text-wit-muted no-underline transition-colors hover:text-wit-text"
      >
        ウィスポ（トップ）
      </DevLink>
      <span className="text-wit-muted/50" aria-hidden="true">|</span>
      <DevLink
        href="/privacy"
        className="text-[13px] text-wit-muted no-underline transition-colors hover:text-wit-text"
      >
        プライバシーポリシー
      </DevLink>
      <span className="text-wit-muted/50" aria-hidden="true">|</span>
      <DevLink
        href="/contact"
        className="text-[13px] text-wit-muted no-underline transition-colors hover:text-wit-text"
      >
        お問い合わせ
      </DevLink>
    </nav>
  );
}

export default function Footer() {
  return (
    <footer
      className="mt-auto border-t border-[var(--wit-border)] py-10 px-6"
      role="contentinfo"
    >
      <Suspense fallback={<nav className="flex justify-center gap-4 mb-4" aria-label="フッターナビゲーション" />}>
        <FooterNav />
      </Suspense>
      <p className="text-center text-sm text-wit-muted">
        &copy; 2026 Wispo. All rights reserved.
      </p>
    </footer>
  );
}
