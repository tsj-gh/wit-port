import type { Metadata } from "next";
import { Suspense } from "react";
import { ReflecLabEducationalI18n } from "@/components/educational/GameEducationalI18n";
import ReflecShotGame from "./ReflecShotGame";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";

export const metadata: Metadata = {
  title: "Reflec-Shot（リフレクショット・知育ラボ）",
  description: "反射とスワイプ射出を試す知育ラボ用プロトタイプ（検索インデックス対象外）。",
  alternates: { canonical: `${BASE_URL}/lab/reflec-shot` },
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
        <Suspense fallback={<div className="py-8 text-sm text-wit-muted">読み込み中…</div>}>
          <ReflecShotGame />
        </Suspense>
      </main>
      <ReflecLabEducationalI18n />
    </>
  );
}
