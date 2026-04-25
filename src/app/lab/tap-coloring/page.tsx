import type { Metadata } from "next";
import { Suspense } from "react";
import { TapColoringEducationalI18n } from "@/components/educational/GameEducationalI18n";
import { GameIntroMiniSection } from "@/components/lab/GameIntroMiniSection";
import { GameTroubleshootingSection } from "@/components/lab/GameTroubleshootingSection";
import { OtherPuzzlesSection } from "@/components/lab/OtherPuzzlesSection";
import { SmartGuardLock } from "@/components/lab/SmartGuardLock";
import { TapColoringLabShell } from "@/components/lab/TapColoringLabShell";
import { gameLabAlternates, gameLabPageSeo } from "@/lib/gameLabPageSeo";
import { buildGameSoftwareApplicationJsonLd } from "@/lib/gameSoftwareApplicationJsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";
const tapColoringJsonLd = buildGameSoftwareApplicationJsonLd("tap-coloring", SITE_URL);

export const metadata: Metadata = {
  title: gameLabPageSeo.tapColoring.title,
  description: gameLabPageSeo.tapColoring.description,
  keywords: ["知育", "ぬりえ", "因果", "色彩", "幼児", "モンテッソーリ", "Wispo"],
  alternates: gameLabAlternates("/lab/tap-coloring"),
};

export default function TapColoringLabPage() {
  return (
    <>
      <SmartGuardLock />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(tapColoringJsonLd) }} />
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-1 flex-col px-4 py-4 md:py-6 lg:max-w-[1400px] lg:px-6">
        <GameIntroMiniSection
          title="教材概要（タップぬりえ）"
          body="色彩認知と原因理解を、短い操作と即時反応で学べる入門教材です。幼児でも始めやすいタップ中心の設計で、完成体験を積みながら集中の持続を育てます。"
        />
        <Suspense fallback={<div className="py-8 text-sm text-[var(--color-muted)]">読み込み中…</div>}>
          <TapColoringLabShell />
        </Suspense>
      </main>
      <TapColoringEducationalI18n />
      <GameTroubleshootingSection
        gameTitle="タップぬりえ"
        items={[
          { issue: "色が思ったようにまとまらない", action: "最初は2〜3色に絞り、塗る順番を先に決めると迷いが減ります。" },
          { issue: "すぐ飽きてしまう", action: "1回で完成を目指さず、「今日は背景まで」のように短い目標を作ると続きやすいです。" },
          { issue: "はみ出しが気になって止まる", action: "正確さより完成経験を優先し、最後に見直し時間を1分だけ取る運用がおすすめです。" },
        ]}
      />
      <OtherPuzzlesSection currentId="tap-coloring" />
    </>
  );
}
