import Link from "next/link";

export default function Footer() {
  return (
    <footer
      className="mt-auto border-t border-[var(--wit-border)] py-10 px-6"
      role="contentinfo"
    >
      <nav
        className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 mb-4"
        aria-label="フッターナビゲーション"
      >
        <Link
          href="/"
          className="text-[13px] text-wit-muted no-underline transition-colors hover:text-wit-text"
        >
          WIT PORT（トップ）
        </Link>
        <span className="text-wit-muted/50" aria-hidden="true">|</span>
        <Link
          href="/privacy"
          className="text-[13px] text-wit-muted no-underline transition-colors hover:text-wit-text"
        >
          プライバシーポリシー
        </Link>
        <span className="text-wit-muted/50" aria-hidden="true">|</span>
        <Link
          href="/contact"
          className="text-[13px] text-wit-muted no-underline transition-colors hover:text-wit-text"
        >
          お問い合わせ
        </Link>
      </nav>
      <p className="text-center text-sm text-wit-muted">
        &copy; 2026 WIT PORT. All rights reserved.
      </p>
    </footer>
  );
}
