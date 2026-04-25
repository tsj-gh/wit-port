import type { Metadata } from "next";
import { Suspense } from "react";
import { PresSureEducationalI18n } from "@/components/educational/GameEducationalI18n";
import { GameIntroMiniSection } from "@/components/lab/GameIntroMiniSection";
import { GameTroubleshootingSection } from "@/components/lab/GameTroubleshootingSection";
import { OtherPuzzlesSection } from "@/components/lab/OtherPuzzlesSection";
import { SmartGuardLock } from "@/components/lab/SmartGuardLock";
import PresSureJudgeGame from "./PresSureJudgeGame";
import { gameLabAlternates, gameLabPageSeo } from "@/lib/gameLabPageSeo";
import { buildGameSoftwareApplicationJsonLd } from "@/lib/gameSoftwareApplicationJsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";
const presSureJsonLd = buildGameSoftwareApplicationJsonLd("pres-sure-judge", SITE_URL);

export const metadata: Metadata = {
  title: gameLabPageSeo.presSureJudge.title,
  description: gameLabPageSeo.presSureJudge.description,
  keywords: ["知育", "パズル", "無料", "バランス", "判断力", "数量感覚", "タイムアタック", "幼児"],
  applicationName: "Wispo",
  alternates: gameLabAlternates("/lab/pres-sure-judge"),
  other: {
    "application:category": "EducationalGame",
    "application:operating-system": "Web Browser",
  },
};

export default function PresSureJudgePage() {
  return (
    <>
      <SmartGuardLock />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(presSureJsonLd) }} />
      <section className="mx-auto mt-4 w-full max-w-[1080px] px-4">
        <GameIntroMiniSection
          title="教材概要（Pres-Sure Judge）"
          body="時間制約下で天秤の均衡を見極める判断教材です。数量感覚と抑制制御を同時に使い、短いラウンドで意思決定の精度を高めます。"
        />
      </section>
      <Suspense fallback={null}>
        <PresSureJudgeGame />
      </Suspense>
      <PresSureEducationalI18n />
      <GameTroubleshootingSection
        gameTitle="Pres-Sure Judge"
        items={[
          { issue: "焦ってJudgeして失敗する", action: "残り時間が短くても、最後の1手前で左右差を声に出して確認してから確定します。" },
          { issue: "重りの配置意図を忘れる", action: "「左を+2」のように目的を短く決めてからドラッグすると判断が安定します。" },
          { issue: "連続ラウンドで精度が落ちる", action: "2〜3ラウンドごとに10秒休憩を入れ、視線を一度画面外に外すと回復しやすいです。" },
        ]}
      />
      <OtherPuzzlesSection currentId="pres-sure-judge" />
    </>
  );
}
