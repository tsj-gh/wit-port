import type { Metadata } from "next";
import PairLinkGame from "./PairLinkGame";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-port.vercel.app";

export const metadata: Metadata = {
  title: "ペアリンク（ナンバーリンク）",
  description:
    "同じ数字を線で繋ぎ、盤面の全マスを埋める無料知育ロジックパズル。ドラッグでスムーズに線を引き、論理的思考力を育みます。",
  keywords: ["知育", "パズル", "無料", "ナンバーリンク", "ペアリンク", "ロジックパズル", "算数", "幼児"],
  applicationName: "WIT PORT",
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
    name: "WIT PORT",
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
      <PairLinkGame />
      <section className="mx-auto max-w-[1080px] w-full px-4 py-6 pb-12" aria-label="このパズルの知育効果">
        <details className="group rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
          <summary className="cursor-pointer list-none px-6 py-4 text-wit-muted text-sm hover:text-wit-text transition-colors select-none">
            <span className="font-medium">このパズルの知育効果について（知育・算数・無料・幼児向け）</span>
          </summary>
          <div className="px-6 pb-6 pt-0">
            <p className="text-wit-muted text-sm leading-relaxed">
              ペアリンク（ナンバーリンク）は、幼児から小学生まで楽しめる無料の知育パズルです。同じ数字同士を線で繋ぎ、盤面を埋めていくシンプルなルールで、論理的思考力と数の感覚を自然に養うことができます。算数の土台となる「数の対応」「順序の理解」が遊びながら身につき、線を引く経路を考える過程で空間認識力や計画性が育ちます。無料で何度でも遊べるため、家庭で気軽に知育に取り組め、継続的な学習効果が期待できます。4×4の入門サイズから段階的に難易度を上げられるので、幼児の初めての算数遊びから小学校低学年の論理パズルまで幅広く対応。線の交差や行き止まりを避ける思考は、プログラミング的思考の基礎にもつながります。幼児期の知育には、遊び感覚で数を意識できる教材が効果的です。無料で使えるため、算数が苦手な子も抵抗なく挑戦でき、論理的思考の入り口として最適。タブレットやスマホ、PC（Windows、macOS、Android、iOS）で利用でき、外出先での知育にも便利。集中力や先読み力も育ち、毎日少しずつ続けることで、数の感覚と論理力が着実に伸びていきます。
            </p>
          </div>
        </details>
      </section>
    </>
  );
}
