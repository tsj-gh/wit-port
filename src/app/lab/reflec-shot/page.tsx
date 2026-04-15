import type { Metadata } from "next";
import { Suspense } from "react";
import { ReflecLabEducationalI18n } from "@/components/educational/GameEducationalI18n";
import ReflecShotGame from "./ReflecShotGame";
import { gameLabAlternates, gameLabPageSeo } from "@/lib/gameLabPageSeo";

export const metadata: Metadata = {
  title: gameLabPageSeo.reflecShot.title,
  description: gameLabPageSeo.reflecShot.description,
  keywords: ["知育", "空間推理", "反射", "幾何", "パズル", "Wispo"],
  applicationName: "Wispo",
  alternates: gameLabAlternates("/lab/reflec-shot"),
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function ReflecShotLabPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-4 md:py-6">
        <Suspense fallback={<div className="py-8 text-sm text-[var(--color-muted)]">読み込み中…</div>}>
          <ReflecShotGame />
        </Suspense>
      </main>
      <ReflecLabEducationalI18n />
    </>
  );
}
