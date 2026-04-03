import Link from "next/link";
import { Suspense } from "react";
import PuzzleStockPrefetcher from "@/components/PuzzleStockPrefetcher";
import { HomePageLinks } from "@/components/HomePageLinks";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1080px] w-full px-6">
      <PuzzleStockPrefetcher />
      <main>
        <section className="text-center py-[60px] pb-20 animate-fade-in-up-delay">
          <h1 className="text-[clamp(32px,5vw,56px)] font-extrabold leading-tight mb-6 bg-gradient-to-r from-white to-wit-muted bg-clip-text text-transparent">
            知育スポーツの拠点
          </h1>
          <p className="text-[clamp(16px,2vw,20px)] text-wit-muted max-w-[600px] mx-auto leading-relaxed">
            直感と論理を交差させる、洗練されたパズルの世界へようこそ。
            <br />
            あなたの「ひらめき」が、ここから始まります。
          </p>
        </section>

        <Suspense fallback={<div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-20 min-h-[320px]" />}>
          <HomePageLinks />
        </Suspense>

        <section className="py-12 border-t border-white/10 animate-fade-in-up-delay-more">
          <h2 className="text-xl font-bold mb-4 text-wit-text">知育コラム</h2>
          <p className="text-wit-muted leading-relaxed mb-4">
            各パズルの知育効果を、脳科学・モンテッソーリ教育・難易度設計の観点からまとめた固定ページです。保護者・教育者向けの参考資料としてご活用ください。
          </p>
          <p className="mb-6">
            <Link
              href="/columns/educational-value"
              className="inline-flex items-center text-sky-300 font-medium underline-offset-2 hover:text-sky-200 hover:underline"
            >
              知育コラムを読む（ロジックパズルと思考力の育成）
            </Link>
          </p>
          <h2 className="text-xl font-bold mb-4 text-wit-text">Wispoについて</h2>
          <p className="text-wit-muted leading-relaxed mb-4">
            Wispoは、論理的思考力と直感を育む知育パズルの無料サイトです。ペアリンク・スカイスクレイパー・Pres-Sure Judgeなど、様々なロジックパズルをブラウザで手軽にお楽しみいただけます。
          </p>
          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">遊び方・ご利用について</h2>
          <p className="text-wit-muted leading-relaxed mb-4">
            各ゲームは無料でプレイ可能です。ルールや操作方法は各ゲーム画面内をご確認ください。お問い合わせは
            <a href="/contact" className="text-wit-accent hover:underline">お問い合わせページ</a>
            より承ります。利用規約・プライバシーポリシーは
            <a href="/privacy" className="text-wit-accent hover:underline">プライバシーポリシー</a>
            をご参照ください。
          </p>
        </section>

        {/* 自動広告用スペース（AdSense 自動広告有効時のみ表示）。本番でスロット未設定時は非表示 */}
        <aside
          className="min-h-[90px] my-8 rounded-xl"
          aria-label="広告スペース"
          style={{ minHeight: 90 }}
        />
      </main>
    </div>
  );
}
