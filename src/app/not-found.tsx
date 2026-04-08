import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-br from-[var(--color-bg)] to-[color-mix(in_srgb,var(--color-surface)_40%,var(--color-bg))] text-[var(--color-text)]">
      <main className="text-center max-w-md">
        <h1 className="text-6xl font-black text-[color-mix(in_srgb,var(--color-muted)_50%,transparent)] mb-4">404</h1>
        <h2 className="text-xl font-bold mb-4 text-[var(--color-text)]">ページが見つかりません</h2>
        <p className="text-[var(--color-muted)] text-sm leading-relaxed mb-8">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 rounded-xl bg-[var(--color-primary)] hover:brightness-95 text-[var(--color-on-primary)] font-medium transition-colors no-underline"
        >
          トップページへ戻る
        </Link>
      </main>
    </div>
  );
}
