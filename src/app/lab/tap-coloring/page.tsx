import type { Metadata } from "next";
import { Suspense } from "react";
import { TapColoringEducationalI18n } from "@/components/educational/GameEducationalI18n";
import { OtherPuzzlesSection } from "@/components/lab/OtherPuzzlesSection";
import { SmartGuardLock } from "@/components/lab/SmartGuardLock";
import { TapColoringLabShell } from "@/components/lab/TapColoringLabShell";
import { gameLabAlternates, gameLabPageSeo } from "@/lib/gameLabPageSeo";
import { buildGameSoftwareApplicationJsonLd } from "@/lib/gameSoftwareApplicationJsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";
const tapColoringJsonLd = buildGameSoftwareApplicationJsonLd("tap-coloring", SITE_URL);

export const metadata: Metadata = {
  title: gameLabPageSeo.tapColoring.title,
  description: gameLabPageSeo.tapColoring.description,
  keywords: ["知育", "ぬりえ", "因果", "色彩", "幼児", "モンテッソーリ", "Wispo"],
  robots: { index: false, follow: false },
  alternates: gameLabAlternates("/lab/tap-coloring"),
};

export default function TapColoringLabPage() {
  return (
    <>
      <SmartGuardLock />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(tapColoringJsonLd) }} />
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-1 flex-col px-4 py-4 md:py-6 lg:max-w-[1400px] lg:px-6">
        <Suspense fallback={<div className="py-8 text-sm text-[var(--color-muted)]">読み込み中…</div>}>
          <TapColoringLabShell />
        </Suspense>
      </main>
      <TapColoringEducationalI18n />
      <OtherPuzzlesSection currentId="tap-coloring" />
    </>
  );
}
