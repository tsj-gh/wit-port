import type { Metadata } from "next";
import { Suspense } from "react";
import { PresSureEducationalI18n } from "@/components/educational/GameEducationalI18n";
import PresSureJudgeGame from "./PresSureJudgeGame";
import { gameLabAlternates, gameLabPageSeo } from "@/lib/gameLabPageSeo";

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
      <Suspense fallback={null}>
        <PresSureJudgeGame />
      </Suspense>
      <PresSureEducationalI18n />
    </>
  );
}
