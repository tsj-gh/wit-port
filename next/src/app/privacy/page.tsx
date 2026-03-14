import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description:
    "WIT PORTのプライバシーポリシー。広告配信とクッキー（Cookie）の利用についてご説明します。",
  keywords: ["知育", "パズル", "無料", "プライバシーポリシー"],
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[720px] w-full px-6">
      <header className="flex justify-between items-center py-8">
        <Link
          href="/"
          className="flex items-center gap-3 text-[28px] font-black tracking-[2px] text-wit-text no-underline hover:opacity-90"
        >
          <span className="block w-8 h-8 rounded-lg bg-gradient-to-br from-wit-accent to-purple-500 shadow-[0_0_15px_var(--wit-accent-glow)]" />
          WIT PORT
        </Link>
        <Link
          href="/"
          className="text-wit-muted text-sm no-underline hover:text-wit-text transition-colors"
        >
          ← トップへ戻る
        </Link>
      </header>

      <main className="pb-20">
        <h1 className="text-2xl sm:text-3xl font-bold mb-8 text-wit-text">
          プライバシーポリシー
        </h1>
        <p className="text-wit-muted text-sm mb-6">最終更新日：2026年</p>

        <article className="rounded-2xl p-6 sm:p-8 border border-white/10 bg-white/5 backdrop-blur">
          <p className="text-wit-muted leading-relaxed mb-6">
            WIT PORT（ウィッポ）では、パズルプレイ体験の向上のため、第三者広告配信サービスを利用しています。本ページでは、当サイトにおける広告配信とクッキー（Cookie）の利用についてご説明します。
          </p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">
            1. 広告配信について
          </h2>
          <p className="text-wit-muted leading-relaxed mb-4">
            当サイトでは、第三者（広告ネットワーク事業者）の提供する広告を掲載しており、広告収益によりサイト運営を賄っております。掲載される広告は、当サイトのコンテンツとは独立して表示されます。
          </p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">
            2. クッキー（Cookie）の利用
          </h2>
          <p className="text-wit-muted leading-relaxed mb-2">
            <strong className="text-wit-text">クッキーとは</strong>、ウェブサイトがユーザーのコンピュータや端末に保存する小さなテキストファイルです。広告配信事業者は、以下の目的でクッキーを利用することがあります。
          </p>
          <ul className="list-disc list-inside text-wit-muted space-y-2 mb-4">
            <li><strong className="text-wit-text">広告の表示最適化</strong>：興味・関心に基づいた広告の配信</li>
            <li><strong className="text-wit-text">表示回数の管理</strong>：同一の広告が過度に表示されないよう制御</li>
            <li><strong className="text-wit-text">効果測定</strong>：広告の表示回数やクリック数の計測</li>
          </ul>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">
            3. 第三者によるクッキーの利用
          </h2>
          <p className="text-wit-muted leading-relaxed mb-4">
            当サイトに掲載される広告は、Google を含む第三者広告配信事業者が配信する場合があります。これらの事業者は、過去のアクセス情報などに基づいて広告を配信するため、クッキーを使用することがあります。詳細は、各広告配信事業者のプライバシーポリシーをご確認ください。
          </p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">
            4. クッキーの無効化
          </h2>
          <p className="text-wit-muted leading-relaxed mb-4">
            お使いのブラウザの設定からクッキーを無効にすることができます。クッキーを無効にした場合、当サイトの一部機能や広告表示に影響がある場合があります。
          </p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">
            5. お問い合わせ
          </h2>
          <p className="text-wit-muted leading-relaxed">
            プライバシーポリシーに関するご質問は、
            <Link href="/contact" className="text-wit-accent hover:underline ml-1">
              お問い合わせフォーム
            </Link>
            よりご連絡ください。
          </p>
        </article>
      </main>
    </div>
  );
}
