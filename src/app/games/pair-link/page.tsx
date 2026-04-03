import type { Metadata } from "next";
import { Suspense } from "react";
import { EducationalValueSection } from "@/components/educational/EducationalValueSection";
import PairLinkGame from "./PairLinkGame";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";

export const metadata: Metadata = {
  title: "ペアリンク（ナンバーリンク）",
  description:
    "同じ数字を線で繋ぎ、盤面の全マスを埋める無料知育ロジックパズル。ドラッグでスムーズに線を引き、論理的思考力を育みます。",
  keywords: ["知育", "パズル", "無料", "ナンバーリンク", "ペアリンク", "ロジックパズル", "算数", "幼児"],
  applicationName: "Wispo",
  other: {
    "application:category": "EducationalGame",
    "application:operating-system": "Windows, macOS, Android, iOS",
  },
};

const pairLinkJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ペアリンク（ナンバーリンク）",
  applicationCategory: "EducationalGame",
  operatingSystem: "Windows, macOS, Android, iOS",
  description:
    "同じ数字を線で繋ぎ、盤面の全マスを埋める無料知育ロジックパズル。ドラッグでスムーズに線を引き、論理的思考力を育みます。",
  url: `${BASE_URL}/games/pair-link`,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "JPY",
  },
  author: {
    "@type": "Organization",
    name: "Wispo",
  },
  featureList: ["知育", "論理的思考", "無料", "幼児向け", "算数", "ロジックパズル"],
};

export default function PairLinkPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pairLinkJsonLd) }}
      />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-wit-bg text-wit-muted">読み込み中…</div>}>
        <PairLinkGame />
      </Suspense>
      <EducationalValueSection summaryLabel="このパズルの知育効果について（専門解説・知育コラム連携）">
        <h3>開発背景</h3>
        <p>
          ペアリンク（ナンバーリンク／Numberlink）は、同じ数字の端点同士を一方通行の線で結び、盤上のすべてのマスを通り、線同士が交差しないという三つの制約を同時に満たす古典的な論理パズルです。紙面やワークでは線の訂正に時間がかかり、誤りに気づくまでのフィードバックも遅れがちでした。Wispo
          ではブラウザ上でドラッグによる描画・撤回が即座に行え、行き詰まりからの再試行が思考のリズムを断ち切らないよう設計しています。指やスタイラスによる操作は微細運動と空間表象を結び、学童期の図形表現活動とも連続した経験となり得ます。
        </p>
        <h3>脳科学的視点</h3>
        <p>
          交差禁止と全盘充填という二重制約下での探索は、誤った仮説を更新し続ける課題として<strong className="text-wit-text">前頭前野</strong>
          が関与する行動結果監視を反復刺激します。仮に引いた経路をワーキングメモリ上に保持しつつ、「数手先で四方が塞がる」といった未来の帰結を先取りする必要が生じ、この
          <strong className="text-wit-text">視空間ワーキングメモリ</strong>
          の負荷は地図読みや展開図の推理と同系の認知過程を介します。適切な難易度での反復は、探索パターンの選別（いわゆるスキーマ化）を促し、単なる暗記ではない学習循環を支えます。
        </p>
        <h3>モンテッソーリ教育の融合</h3>
        <p>
          モンテッソーリにおける<strong className="text-wit-text">デモンストレーション</strong>
          は、教師が全体を代行するのではなく、子どもが自力で試すために必要最小限の秩序だけを示す技法です。ペアリンクでは「線は交差しない」「マスに余白を残さない」というルールが画面に明示され、経路の発見そのものは児童の反復に委ねられます。規則違反は操作としてすぐに返るため、外部からの叱責に頼らない
          <strong className="text-wit-text">自己訂正</strong>へつながりやすく、自己教育の環境としての性格を帯びます。
        </p>
        <h3>ステップアップの設計（グレード G1〜）</h3>
        <p>
          グレード（G1〜）は盤面サイズとペア数、および生成上の制約を段階的に増やす設計です。入門段階では視覚的な探索範囲が狭く、小さな成功体験による
          <strong className="text-wit-text">達成感の定着</strong>
          が得やすくなります。高次グレードでは探索空間が広がり、仮説の保持時間と計画の持続が求められます。線をグラフの辺・マスを頂点とみなす視点は、将来の離散数学やネットワークの直観の下地ともなり得ます。保護者が伴走するときは正答を急いで与えるより、「次に危険なマスはどこか」を言語化して共有することが、子どものメタ認知の言語化を助けます。
        </p>
      </EducationalValueSection>
    </>
  );
}
