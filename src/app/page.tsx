import { Suspense } from "react";
import PuzzleStockPrefetcher from "@/components/PuzzleStockPrefetcher";
import { HomePageLinks } from "@/components/HomePageLinks";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1080px] w-full px-6">
      <PuzzleStockPrefetcher />
      <main>
        <section className="text-center py-[60px] pb-20 animate-fade-in-up-delay">
          <h1 className="text-[clamp(32px,5vw,56px)] font-extrabold leading-tight mb-6 bg-gradient-to-r from-white to-wit-muted bg-clip-text text-transparent">
            知育スポーツの拠点
          </h1>
          <p className="text-[clamp(16px,2vw,20px)] text-wit-muted max-w-[600px] mx-auto leading-relaxed">
            直感と論理を交差させる、洗練されたパズルの世界へようこそ。
            <br />
            あなたの「ひらめき」が、ここから始まります。
          </p>
        </section>

        <Suspense fallback={<div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-20 min-h-[320px]" />}>
          <HomePageLinks />
        </Suspense>

        <aside
          className="min-h-[90px] my-6 flex items-center justify-center rounded-xl border border-[var(--wit-border)] bg-[rgba(30,41,59,0.4)] text-wit-muted text-[11px] tracking-wider"
          aria-label="広告スペース"
        >
          AD
        </aside>
      </main>
    </div>
  );
}
