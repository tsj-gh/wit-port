import type { Metadata } from "next";
import { Suspense } from "react";
import { SkyscraperEducationalI18n } from "@/components/educational/GameEducationalI18n";
import { GameIntroMiniSection } from "@/components/lab/GameIntroMiniSection";
import { GameTroubleshootingSection } from "@/components/lab/GameTroubleshootingSection";
import { OtherPuzzlesSection } from "@/components/lab/OtherPuzzlesSection";
import { SmartGuardLock } from "@/components/lab/SmartGuardLock";
import SkyscraperGame from "./SkyscraperGame";
import { gameLabAlternates, gameLabPageSeo } from "@/lib/gameLabPageSeo";
import { buildGameSoftwareApplicationJsonLd } from "@/lib/gameSoftwareApplicationJsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";
const skyscraperJsonLd = buildGameSoftwareApplicationJsonLd("skyscraper", SITE_URL);

export const metadata: Metadata = {
  title: gameLabPageSeo.skyscraper.title,
  description: gameLabPageSeo.skyscraper.description,
  keywords: ["知育", "パズル", "無料", "スカイスクレイパー", "ビルパズル", "ロジックパズル", "算数", "幼児"],
  applicationName: "Wispo",
  alternates: gameLabAlternates("/lab/skyscraper"),
  other: {
    "application:category": "EducationalGame",
    "application:operating-system": "Windows, macOS, Android, iOS",
  },
};

export default function SkyscraperPage() {
  return (
    <>
      <SmartGuardLock />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(skyscraperJsonLd) }} />
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-1 flex-col px-4 py-4 md:py-6 lg:max-w-[1400px] lg:px-6">
        <Suspense fallback={<div className="flex min-h-[40dvh] flex-1 items-center justify-center bg-[var(--color-bg)] text-[var(--color-muted)]">読み込み中…</div>}>
          <SkyscraperGame />
        </Suspense>
        <GameIntroMiniSection
          title="教材概要（Skyscraper）"
          body="外周ヒントを使って内部配置を推理する制約充足型の教材です。候補整理と演繹推論を段階的に育て、算数的な場合分けの基礎づくりに役立ちます。"
        />
      </main>
      <SkyscraperEducationalI18n />
      <GameTroubleshootingSection
        gameTitle="Skyscraper"
        items={[
          { issue: "候補が多すぎて止まる", action: "まずヒント1やNが作る確定配置から埋め、候補を一気に減らします。" },
          { issue: "行列の重複管理が難しい", action: "行と列を交互に見るリズムに固定し、確定値を入れたら必ず反対軸を更新します。" },
          { issue: "推理が行き詰まる", action: "1マスだけ仮置きして矛盾チェックする「短い仮説検証」を使うと再開しやすいです。" },
        ]}
      />
      <OtherPuzzlesSection currentId="skyscraper" />
    </>
  );
}
