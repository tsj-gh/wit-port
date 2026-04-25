import type { Metadata } from "next";
import { Suspense } from "react";
import { PresSureEducationalI18n } from "@/components/educational/GameEducationalI18n";
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
      <PresSureEducationalI18n />
      <OtherPuzzlesSection currentId="pres-sure-judge" />
    </>
  );
}
