import { Suspense } from "react";
import { HomePageClient } from "@/components/HomePageClient";
import PuzzleStockPrefetcher from "@/components/PuzzleStockPrefetcher";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1080px] w-full px-6">
      <PuzzleStockPrefetcher />
      <main>
        <Suspense
          fallback={<div className="grid min-h-[320px] grid-cols-1 gap-8 pb-10 sm:grid-cols-2 lg:grid-cols-4" />}
        >
          <HomePageClient />
        </Suspense>

        {/* 自動広告用スペース（AdSense 自動広告有効時のみ表示）。本番でスロット未設定時は非表示 */}
        <aside
          className="mb-10 mt-12 min-h-[90px] rounded-xl"
          aria-label="広告スペース"
          style={{ minHeight: 90 }}
        />
      </main>
    </div>
  );
}
