import type { Metadata } from "next";
import SkyscraperGame from "./SkyscraperGame";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";

export const metadata: Metadata = {
  title: "空の上から（Skyscrapers）",
  description:
    "外枠の数字をヒントに、重なり合うビルの高さを推理する無料知育パズル。メイビー蜂さんの力で論理の糸口を掴もう！",
  keywords: ["知育", "パズル", "無料", "スカイスクレイパー", "ビルパズル", "ロジックパズル", "算数", "幼児"],
  applicationName: "Wit-Spot",
  other: {
    "application:category": "EducationalGame",
    "application:operating-system": "Windows, macOS, Android, iOS",
  },
};

const skyscraperJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "空の上から（スカイスクレイパー / ビルパズル）",
  applicationCategory: "EducationalGame",
  operatingSystem: "Windows, macOS, Android, iOS",
  description:
    "外枠の数字をヒントに、重なり合うビルの高さを推理する無料知育パズル。メイビー蜂さんの力で論理の糸口を掴もう。",
  url: `${BASE_URL}/games/skyscraper`,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "JPY",
  },
  author: {
    "@type": "Organization",
    name: "Wit-Spot",
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
      <SkyscraperGame />
      <section className="mx-auto max-w-[1080px] w-full px-4 py-6 pb-12" aria-label="このパズルの知育効果">
        <details className="group rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
          <summary className="cursor-pointer list-none px-6 py-4 text-wit-muted text-sm hover:text-wit-text transition-colors select-none">
            <span className="font-medium">このパズルの知育効果について（知育・算数・無料・幼児向け）</span>
          </summary>
          <div className="px-6 pb-6 pt-0">
            <p className="text-wit-muted text-sm leading-relaxed">
              空の上から（スカイスクレイパー・ビルパズル）は、幼児から大人まで楽しめる無料の知育パズルです。外枠の数字をヒントに、グリッド上にビルの高さを推理して配置していくロジックパズルで、論理的思考力と数感の育成に最適です。算数の基礎となる「数の大小比較」「順序の理解」「推理と仮説の検証」が、遊びながら自然に身につきます。ヒントから「このマスにはこの数字しか入らない」といった消去法的思考を繰り返すことで、論理的推論力が養われ、複数の条件を同時に満たす試行錯誤の過程で問題解決力が育まれます。無料で何度でもプレイできるため、家庭で気軽に知育に取り組め、幼児の数の感覚づくりから小学校中学年の論理パズル、大人の脳トレまで幅広く活用できます。メイビー蜂さんのメイビーモードで仮の数字を試せるので、難しい問題にも段階的に挑戦でき、算数が苦手な子も楽しみながら数感を伸ばせます。Windows、macOS、Android、iOS対応で、タブレットやスマホからも手軽に無料で知育に取り組め、外出先や隙間時間の算数遊びとしておすすめです。
            </p>
          </div>
        </details>
      </section>
    </>
  );
}
