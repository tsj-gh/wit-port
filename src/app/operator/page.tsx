import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "運営者情報 | Wispo",
  description: "Wispo の運営目的、制作体制、更新方針、お問い合わせ方針を公開しています。",
};

export default function OperatorPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-black text-[var(--color-text)]">運営者情報</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
          Wispo は、家庭学習で継続しやすいデジタル知育教材を目指して運営している、個人開発ベースの教育コンテンツプロジェクトです。
        </p>
      </header>

      <section className="space-y-3">
        <article className="rounded-2xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)] px-4 py-3">
          <h2 className="text-base font-bold text-[var(--color-text)]">運営目的</h2>
          <p className="mt-1 m-0 text-sm leading-relaxed text-[var(--color-muted)]">
            遊びとして成立する体験を維持しながら、空間把握・論理推論・数量感覚などの基礎認知スキルを自然に育てる教材を公開しています。
          </p>
        </article>

        <article className="rounded-2xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)] px-4 py-3">
          <h2 className="text-base font-bold text-[var(--color-text)]">制作・運用体制</h2>
          <p className="mt-1 m-0 text-sm leading-relaxed text-[var(--color-muted)]">
            仕様設計・UI改善・知育解説の編集を継続的に実施し、更新内容は
            <Link href="/updates" className="ml-1 text-[var(--color-accent)] hover:underline">
              更新履歴
            </Link>
            で公開しています。
          </p>
        </article>

        <article className="rounded-2xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)] px-4 py-3">
          <h2 className="text-base font-bold text-[var(--color-text)]">お問い合わせ方針</h2>
          <p className="mt-1 m-0 text-sm leading-relaxed text-[var(--color-muted)]">
            不具合報告、導入相談、改善提案は
            <Link href="/contact" className="ml-1 text-[var(--color-accent)] hover:underline">
              お問い合わせページ
            </Link>
            から受け付けています。確認後、必要に応じて更新履歴に反映します。
          </p>
        </article>
      </section>
    </main>
  );
}
