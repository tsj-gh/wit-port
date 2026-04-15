import type { Metadata } from "next";
import { Suspense } from "react";
import { PopPopBubblesLabShell } from "@/components/lab/PopPopBubblesLabShell";
import { gameLabAlternates, gameLabPageSeo } from "@/lib/gameLabPageSeo";

export const metadata: Metadata = {
  title: gameLabPageSeo.popPopBubbles.title,
  description: gameLabPageSeo.popPopBubbles.description,
  keywords: ["知育", "手眼協調", "集中", "幼児", "バブル", "タップゲーム", "Wispo"],
  robots: { index: false, follow: false },
  alternates: gameLabAlternates("/lab/pop-pop-bubbles"),
};
export default function PopPopBubblesPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-4 md:py-6">
      <Suspense fallback={<div className="py-8 text-sm text-[var(--color-muted)]">読み込み中…</div>}>
        <PopPopBubblesLabShell />
      </Suspense>
    </main>
  );
}
