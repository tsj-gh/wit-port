import type { Metadata } from "next";
import { Suspense } from "react";
import { PairLinkEducationalI18n } from "@/components/educational/GameEducationalI18n";
import { OtherPuzzlesSection } from "@/components/lab/OtherPuzzlesSection";
import { SmartGuardLock } from "@/components/lab/SmartGuardLock";
import PairLinkGame from "./PairLinkGame";
import { gameLabAlternates, gameLabPageSeo } from "@/lib/gameLabPageSeo";
import { buildGameSoftwareApplicationJsonLd } from "@/lib/gameSoftwareApplicationJsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";
const pairLinkJsonLd = buildGameSoftwareApplicationJsonLd("pair-link", SITE_URL);

export const metadata: Metadata = {
  title: gameLabPageSeo.pairLink.title,
  description: gameLabPageSeo.pairLink.description,
  keywords: ["知育", "パズル", "無料", "ナンバーリンク", "ペアリンク", "ロジックパズル", "算数", "幼児"],
  applicationName: "Wispo",
  alternates: gameLabAlternates("/lab/pair-link"),
  other: {
    "application:category": "EducationalGame",
    "application:operating-system": "Windows, macOS, Android, iOS",
  },
};

export default function PairLinkPage() {
  return (
    <>
      <SmartGuardLock />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pairLinkJsonLd) }} />
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-1 flex-col px-4 py-4 md:py-6 lg:max-w-[1400px] lg:px-6">
        <Suspense fallback={<div className="flex min-h-[40dvh] flex-1 items-center justify-center bg-[var(--color-bg)] text-[var(--color-muted)]">読み込み中…</div>}>
          <PairLinkGame />
        </Suspense>
      </main>
      <PairLinkEducationalI18n />
      <OtherPuzzlesSection currentId="pair-link" />
    </>
  );
}
