import type { Metadata } from "next";
import { Suspense } from "react";
import { SkyscraperEducationalI18n } from "@/components/educational/GameEducationalI18n";
import { OtherPuzzlesSection } from "@/components/lab/OtherPuzzlesSection";
import SkyscraperGame from "./SkyscraperGame";
import { gameLabAlternates, gameLabPageSeo } from "@/lib/gameLabPageSeo";
import { buildGameSoftwareApplicationJsonLd } from "@/lib/gameSoftwareApplicationJsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";
const skyscraperJsonLd = buildGameSoftwareApplicationJsonLd("skyscraper", SITE_URL);

export const metadata: Metadata = {
  title: gameLabPageSeo.skyscraper.title,
  description: gameLabPageSeo.skyscraper.description,
  keywords: ["知育", "パズル", "無料", "スカイスクレイパー", "ビルパズル", "ロジックパズル", "算数", "幼児"],
  applicationName: "Wispo",
  alternates: gameLabAlternates("/lab/skyscraper"),
  other: {
    "application:category": "EducationalGame",
    "application:operating-system": "Windows, macOS, Android, iOS",
  },
};

export default function SkyscraperPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(skyscraperJsonLd) }} />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] text-[var(--color-muted)]">読み込み中…</div>}>
        <SkyscraperGame />
      </Suspense>
      <SkyscraperEducationalI18n />
      <OtherPuzzlesSection currentId="skyscraper" />
    </>
  );
}
