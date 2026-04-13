import type { Metadata } from "next";
import { Suspense } from "react";
import { TapColoringEducationalI18n } from "@/components/educational/GameEducationalI18n";
import { ColoringCanvas } from "@/components/lab/ColoringCanvas";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";

export const metadata: Metadata = {
  title: "タップぬりえ（実験）",
  description: "タップで色が広がる幼児向けぬりえプロトタイプ（実験ページ）",
  robots: { index: false, follow: false },
  alternates: { canonical: `${BASE_URL}/lab/tap-coloring` },
};

export default function TapColoringLabPage() {
  return (
    <>
      <main className="min-h-dvh bg-stone-50 text-stone-800">
        <Suspense fallback={<div className="p-8 text-center text-sm text-stone-500">読み込み中…</div>}>
          <ColoringCanvas />
        </Suspense>
      </main>
      <TapColoringEducationalI18n />
    </>
  );
}
