import type { Metadata } from "next";
import { Suspense } from "react";
import { PresSureEducationalI18n } from "@/components/educational/GameEducationalI18n";
import { GameQuickInfoNote } from "@/components/lab/GameQuickInfoNote";
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
      <Suspense fallback={null}>
        <PresSureJudgeGame />
      </Suspense>
      <section className="mx-auto mt-6 w-full max-w-[1080px] px-4">
        <GameQuickInfoNote
          goal="数量判断・抑制制御・時間制約下の意思決定を同時に訓練"
          target="小学校中学年〜大人"
          operation="重りをドラッグ配置し、Judgeで均衡判定"
        />
      </section>
      <PresSureEducationalI18n />
      <OtherPuzzlesSection currentId="pres-sure-judge" />
    </>
  );
}
