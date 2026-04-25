import type { Metadata } from "next";
import { Suspense } from "react";
import { SkyscraperEducationalI18n } from "@/components/educational/GameEducationalI18n";
import { GameQuickInfoNote } from "@/components/lab/GameQuickInfoNote";
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
        <section className="mx-auto mt-6 w-full max-w-3xl">
          <GameQuickInfoNote
            goal="外周ヒントからの演繹推論・場合分け・検証力を育成"
            target="小学校高学年〜大人"
            operation="数字入力とメモ機能を使って行列の高さを推理"
          />
        </section>
      </main>
      <SkyscraperEducationalI18n />
      <OtherPuzzlesSection currentId="skyscraper" />
    </>
  );
}
