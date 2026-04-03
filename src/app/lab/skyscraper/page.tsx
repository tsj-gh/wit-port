import type { Metadata } from "next";
import { Suspense } from "react";
import { EducationalValueSection } from "@/components/educational/EducationalValueSection";
import SkyscraperGame from "./SkyscraperGame";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";

export const metadata: Metadata = {
  title: "Skyscraper（スカイスクレイパー）",
  description:
    "外枠の数字をヒントに、重なり合うビルの高さを推理する無料知育パズル。メイビー蜂さんの力で論理の糸口を掴もう！",
  keywords: ["知育", "パズル", "無料", "スカイスクレイパー", "ビルパズル", "ロジックパズル", "算数", "幼児"],
  applicationName: "Wispo",
  alternates: { canonical: `${BASE_URL}/lab/skyscraper` },
  other: {
    "application:category": "EducationalGame",
    "application:operating-system": "Windows, macOS, Android, iOS",
  },
};

const skyscraperJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Skyscraper（スカイスクレイパー）",
  applicationCategory: "EducationalGame",
  operatingSystem: "Windows, macOS, Android, iOS",
  description:
    "外枠の数字をヒントに、重なり合うビルの高さを推理する無料知育パズル。メイビー蜂さんの力で論理の糸口を掴もう。",
  url: `${BASE_URL}/lab/skyscraper`,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "JPY",
  },
  author: {
    "@type": "Organization",
    name: "Wispo",
  },
  featureList: ["知育", "論理的思考", "数感の育成", "無料", "幼児向け", "算数", "ロジックパズル"],
};

export default function SkyscraperPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(skyscraperJsonLd) }}
      />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-wit-bg text-wit-muted">読み込み中…</div>}>
        <SkyscraperGame />
      </Suspense>
      <EducationalValueSection summaryLabel="このパズルの知育効果について（専門解説・知育コラム連携）">
        <h3>開発背景</h3>
        <p>
          Skyscraper（スカイスクレイパー）は、各行・各列に 1〜N の高さを一度ずつ配置し、盤外のヒント数字が「その方向から見えたビルの棟数」と一致するよう満たす制約充足型の論理パズルです。
          <strong className="text-wit-text">ラテン方陣性</strong>（行列で重複のない配置）と<strong className="text-wit-text">可視カウント</strong>
          という二系統の推論が交差するため、紙面では消去の記述が煩雑になりがちでした。デジタル化により仮置きと検証を高速に繰り返せ、記号操作の負荷を下げて本質的な制約推理へ注意を向けさせます。学童後期から大人の脳トレまで、幅広い年齢帯が同一ルールのもとで深さだけを変えて遊べる点も意図しています。
        </p>
        <h3>脳科学的視点</h3>
        <p>
          ヒントを満たさない配置へ至るたび、脳は<strong className="text-wit-text">予測と誤りのギャップ</strong>
          を処理し、前頭前野を中心とする行動更新ループを回します。頭上視点でビルを並べる際、心の中で遮蔽関係をシミュレートする過程は空間推論と数の大小比較を結合します。
          <strong className="text-wit-text">メイビーモード</strong>
          で仮の数字を載せられる設計は、ワーキングメモリの負荷を一時的に盤面へ外部化し、仮説と確定配置を区別する練習（スキャフォールディング）として機能します。複数制約を同時に満たす試行は、算数の場合分けや理科の多変数問題に通じる持久力を養います。
        </p>
        <h3>モンテッソーリ教育の融合</h3>
        <p>
          モンテッソーリが重んじる<strong className="text-wit-text">秩序・正確さ・集中</strong>
          に照らすと、盤面が静かに保たれ操作が即時に反映される環境は、児童の心を整えるための外部秩序として働き得ます。教師や保護者の頻繁な割り込みを減じ、児童が自発的に検証サイクルへ戻れることが重要です。メイビーはあくまで支援であり、最終判断の主役は常に子ども自身であるというバランスが、自己教育の原則と整合します。
        </p>
        <h3>ステップアップの設計（サイズ・難易度）</h3>
        <p>
          盤サイズ（例：4×4 入門〜 6×6 上級）と難易プリセットにより、推理の探索空間を段階的に拡大します。小さな盤ではヒントが強く効き、最大・最小のビルが可視カウントを強制するといった
          <strong className="text-wit-text">論理パターンの型</strong>
          を体感的に蓄積しやすくなります。大きな盤では制約の組合せが複雑化し、先読みとバックトラックに近い思考の持続が求められます。この勾配は、算数における「同時条件の整理」や論述の筋道立ての下地としても参照できます。
        </p>
      </EducationalValueSection>
    </>
  );
}
