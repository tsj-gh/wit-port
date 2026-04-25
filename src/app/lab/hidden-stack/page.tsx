import type { Metadata } from "next";
import { Suspense } from "react";
import { HiddenStackEducationalI18n } from "@/components/educational/GameEducationalI18n";
import { GameQuickInfoNote } from "@/components/lab/GameQuickInfoNote";
import { OtherPuzzlesSection } from "@/components/lab/OtherPuzzlesSection";
import { SmartGuardLock } from "@/components/lab/SmartGuardLock";
import HiddenStackGame from "./HiddenStackGame";
import { gameLabAlternates, gameLabPageSeo } from "@/lib/gameLabPageSeo";
import { buildGameSoftwareApplicationJsonLd } from "@/lib/gameSoftwareApplicationJsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";
const hiddenStackJsonLd = buildGameSoftwareApplicationJsonLd("hidden-stack", SITE_URL);

export const metadata: Metadata = {
  title: gameLabPageSeo.hiddenStack.title,
  description: gameLabPageSeo.hiddenStack.description,
  keywords: ["知育", "パズル", "3D", "空間認知", "Hidden Stack", "かくれつみき", "積み木"],
  applicationName: "Wispo",
  alternates: gameLabAlternates("/lab/hidden-stack"),
  other: {
    "application:category": "EducationalGame",
    "application:operating-system": "Windows, macOS, Android, iOS",
  },
};

export default function HiddenStackPage() {
  return (
    <>
      <SmartGuardLock />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(hiddenStackJsonLd) }} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-2 md:py-3 lg:max-w-none lg:px-0 lg:py-3">
        <Suspense
          fallback={
            <div className="flex min-h-[40dvh] flex-1 items-center justify-center bg-[var(--color-bg)] text-[var(--color-muted)]">
              読み込み中…
            </div>
          }
        >
          <div className="flex w-full flex-1 flex-col">
            <HiddenStackGame />
          </div>
        </Suspense>
        <section className="mx-auto mt-6 w-full max-w-3xl">
          <GameQuickInfoNote
            goal="遮蔽を含む空間把握・数量推定・推理の言語化を促進"
            target="小学校低学年〜大人"
            operation="盤面を観察して死角の積み木数を選択し、ふりかえりで検証"
          />
        </section>
      </main>
      <HiddenStackEducationalI18n />
      <OtherPuzzlesSection currentId="hidden-stack" />
    </>
  );
}
