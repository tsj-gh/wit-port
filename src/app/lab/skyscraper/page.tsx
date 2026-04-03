import type { Metadata } from "next";
import { Suspense } from "react";
import { SkyscraperEducationalI18n } from "@/components/educational/GameEducationalI18n";
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
      <SkyscraperEducationalI18n />
    </>
  );
}
