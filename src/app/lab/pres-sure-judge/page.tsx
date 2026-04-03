import type { Metadata } from "next";
import { Suspense } from "react";
import { PresSureEducationalI18n } from "@/components/educational/GameEducationalI18n";
import PresSureJudgeGame from "./PresSureJudgeGame";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";

export const metadata: Metadata = {
  title: "Pres-Sure Judge（プレッシャージャッジ）",
  description:
    "NPCの重りvs自分の重り。10秒以内に均衡を保て。判定ミスは累積するサバイバル・バランシングゲーム。",
  keywords: ["知育", "パズル", "無料", "バランス", "サバイバル", "タイムアタック"],
  alternates: { canonical: `${BASE_URL}/lab/pres-sure-judge` },
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
