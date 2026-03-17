import type { Metadata } from "next";
import { Suspense } from "react";
import PresSureJudgeGame from "./PresSureJudgeGame";

export const metadata: Metadata = {
  title: "Pres-Sure Judge（プレッシャージャッジ）",
  description:
    "NPCの重りvs自分の重り。10秒以内に均衡を保て。判定ミスは累積するサバイバル・バランシングゲーム。",
  keywords: ["知育", "パズル", "無料", "バランス", "サバイバル", "タイムアタック"],
};

export default function PresSureJudgePage() {
  return (
    <Suspense fallback={null}>
      <PresSureJudgeGame />
    </Suspense>
  );
}
