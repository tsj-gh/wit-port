import type { Metadata } from "next";
import { Suspense } from "react";
import { TapColoringEducationalI18n } from "@/components/educational/GameEducationalI18n";
import { TapColoringLabShell } from "@/components/lab/TapColoringLabShell";

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
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-4 md:py-6">
        <Suspense fallback={<div className="py-8 text-sm text-[var(--color-muted)]">読み込み中…</div>}>
          <TapColoringLabShell />
        </Suspense>
      </main>
      <TapColoringEducationalI18n />
    </>
  );
}
