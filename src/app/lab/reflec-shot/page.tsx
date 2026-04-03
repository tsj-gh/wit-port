import type { Metadata } from "next";
import { Suspense } from "react";
import ReflecShotGame from "./ReflecShotGame";

export const metadata: Metadata = {
  title: "Reflec-Shot（知育ラボ・プロト）",
  description: "反射とスワイプ射出を試す知育ラボ用プロトタイプ（検索インデックス対象外）。",
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-4 md:py-6">
      <Suspense fallback={<div className="py-8 text-sm text-wit-muted">読み込み中…</div>}>
        <ReflecShotGame />
      </Suspense>
    </main>
  );
}
