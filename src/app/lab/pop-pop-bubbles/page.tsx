import type { Metadata } from "next";
import { Suspense } from "react";
import { PopPopBubblesEducationalSection } from "@/components/educational/PopPopBubblesEducationalSection";
import { OtherPuzzlesSection } from "@/components/lab/OtherPuzzlesSection";
import { PopPopBubblesLabShell } from "@/components/lab/PopPopBubblesLabShell";
import { gameLabAlternates, gameLabPageSeo } from "@/lib/gameLabPageSeo";
import { buildGameSoftwareApplicationJsonLd } from "@/lib/gameSoftwareApplicationJsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";
const popPopBubblesJsonLd = buildGameSoftwareApplicationJsonLd("pop-pop-bubbles", SITE_URL);

export const metadata: Metadata = {
  title: gameLabPageSeo.popPopBubbles.title,
  description: gameLabPageSeo.popPopBubbles.description,
  keywords: ["知育", "手眼協調", "集中", "幼児", "バブル", "タップゲーム", "Wispo"],
  robots: { index: false, follow: false },
  alternates: gameLabAlternates("/lab/pop-pop-bubbles"),
};
export default function PopPopBubblesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(popPopBubblesJsonLd) }}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-4 md:py-6">
        <Suspense fallback={<div className="py-8 text-sm text-[var(--color-muted)]">読み込み中…</div>}>
          <PopPopBubblesLabShell />
        </Suspense>
      </main>
      <PopPopBubblesEducationalSection />
      <OtherPuzzlesSection currentId="pop-pop-bubbles" />
    </>
  );
}
