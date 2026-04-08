import type { Metadata } from "next";
import { Suspense } from "react";
import { PairLinkEducationalI18n } from "@/components/educational/GameEducationalI18n";
import PairLinkGame from "./PairLinkGame";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";

export const metadata: Metadata = {
  title: "Pair-Link（ペアリンク）",
  description:
    "同じ数字を線で繋ぎ、盤面の全マスを埋める無料知育ロジックパズル。ドラッグでスムーズに線を引き、論理的思考力を育みます。",
  keywords: ["知育", "パズル", "無料", "ナンバーリンク", "ペアリンク", "ロジックパズル", "算数", "幼児"],
  applicationName: "Wispo",
  alternates: { canonical: `${BASE_URL}/lab/pair-link` },
  other: {
    "application:category": "EducationalGame",
    "application:operating-system": "Windows, macOS, Android, iOS",
  },
};

const pairLinkJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Pair-Link（ペアリンク）",
  applicationCategory: "EducationalGame",
  operatingSystem: "Windows, macOS, Android, iOS",
  description:
    "同じ数字を線で繋ぎ、盤面の全マスを埋める無料知育ロジックパズル。ドラッグでスムーズに線を引き、論理的思考力を育みます。",
  url: `${BASE_URL}/lab/pair-link`,
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
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] text-[var(--color-muted)]">読み込み中…</div>}>
        <PairLinkGame />
      </Suspense>
      <PairLinkEducationalI18n />
    </>
  );
}
