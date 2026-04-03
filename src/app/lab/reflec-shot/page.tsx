import type { Metadata } from "next";
import { Suspense } from "react";
import { EducationalValueSection } from "@/components/educational/EducationalValueSection";
import ReflecShotGame from "./ReflecShotGame";

export const metadata: Metadata = {
  title: "Reflec-Shot（知育ラボ・プロト）",
  description: "反射とスワイプ射出を試す知育ラボ用プロトタイプ（検索インデックス対象外）。",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function ReflecShotLabPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-4 md:py-6">
        <Suspense fallback={<div className="py-8 text-sm text-wit-muted">読み込み中…</div>}>
          <ReflecShotGame />
        </Suspense>
      </main>
      <EducationalValueSection summaryLabel="このパズルの知育効果について（専門解説・知育コラム連携）">
        <h3>開発背景</h3>
        <p>
          Reflec-Shot は、鏡や壁による反射という具体的経験を、格子・外周・バンパー記号（／＼－｜）に抽象化し、射出体の道筋を論理的に決定する知育ラボ向けのプロトタイプです。物理実験は準備と安全確保にコストがかかり、角度の再現にもばらつきが生じます。デジタル上では等速移動と反射規則を
          <strong className="text-wit-text">誤差なく再現</strong>
          でき、仮説がすぐに視覚的帰結へ変換されます。幾何の直感と記号的操作の往復を、短いサイクルで繰り返せることがデジタル化の中核的動機です。
        </p>
        <h3>脳科学的視点</h3>
        <p>
          各試行で「放置→軌道の成功／失敗」が明瞭に返る課題は、<strong className="text-wit-text">行動結果監視</strong>
          を反復刺激します。マス単位の移動予測には方向の更新と系列保持が必要で、ワーキングメモリ負荷は迷路課題と重なる部分があります。長押しのあとスワイプしてバンパーの種別を確定させる操作は、運動計画と短時間の戦略決定を連結し、
          <strong className="text-wit-text">認知的柔軟性</strong>
          の訓練に近い性質を持ちます。ゴールパッドへの到達条件が明文化されているため、誤りの原因帰属も比較的容易です。
        </p>
        <h3>モンテッソーリ教育の融合</h3>
        <p>
          モンテッソーリ教具が重視する「誤りが環境から明らかになる」構造は、Reflec-Shot の失敗条件（壁向きへの進行、スタート側パッドへの戻り、ゴール未到達など）が画面上で一義的に示されることと呼応します。児童は規則を自分の操作ログと照合し、大人の都度訂正に頼らず
          <strong className="text-wit-text">自己評価</strong>
          へ進みやすくなります。デモンストレーションは反射の向き変化という最小の秩序だけを示し、経路探索は児童の反復に委ねる設計思想と整合します。
        </p>
        <h3>ステップアップの設計（グレード G1〜）</h3>
        <p>
          グレードを上げるごとに盤のマス数やバンパー配置の複雑さが増し、単純な直線予測から多段反射の系列推論へ移行します。低グレードでの成功はモンテッソーリ的にいう
          <strong className="text-wit-text">自我の充実</strong>
          （課題を自力で完結できたという感情）を支え、高グレードでの難関は持続的注意と計画の持続時間を鍛えます。ラボとして公開している点は、家庭や教室で小規模に観察・試用してから本格導入する、いわば準備段階の環境としても位置づけられます。
        </p>
      </EducationalValueSection>
    </>
  );
}
