import Link from "next/link";
import PuzzleStockPrefetcher from "@/components/PuzzleStockPrefetcher";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1080px] w-full px-6">
      <PuzzleStockPrefetcher />
      <header className="flex justify-between items-center py-8 animate-fade-in-up">
        <Link
          href="/"
          className="flex items-center gap-3 text-[28px] font-black tracking-[2px] text-wit-text no-underline"
        >
          <span className="block w-8 h-8 rounded-lg bg-gradient-to-br from-wit-accent to-purple-500 shadow-[0_0_15px_var(--wit-accent-glow)]" />
          Wit-Spot
        </Link>
      </header>

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

        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-20 animate-fade-in-up-delay-more">
          <Link
            href="/games/pair-link"
            className="group relative flex flex-col rounded-[20px] p-8 overflow-hidden no-underline text-wit-text border border-[var(--wit-border)] bg-[var(--wit-card-bg)] backdrop-blur-[10px] transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] hover:-translate-y-2 hover:shadow-wit-card-hover hover:border-white/20 after:absolute after:inset-0 after:content-[''] after:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_50%)] after:opacity-0 after:transition-opacity after:duration-300 group-hover:after:opacity-100"
          >
            <span className="text-5xl mb-6 inline-block animate-float">✨</span>
            <h2 className="text-2xl font-bold mb-3">ペアリンク</h2>
            <p className="text-wit-muted text-[15px] leading-relaxed flex-grow mb-6">
              盤面上の同じキャラクター同士を、線が交差しないように繋ぎ合わせる直感型ロジックパズル。すべてのマスを埋めて、鮮やかなクリアを目指そう。
            </p>
            <div className="flex items-center justify-center gap-2 bg-wit-accent text-white py-3 px-6 rounded-xl font-bold text-base w-full transition-colors group-hover:bg-blue-600">
              出航する（Play）
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </Link>

          <Link
            href="/games/skyscraper"
            className="group relative flex flex-col rounded-[20px] p-8 overflow-hidden no-underline text-wit-text border border-[var(--wit-border)] bg-[var(--wit-card-bg)] backdrop-blur-[10px] transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] hover:-translate-y-2 hover:shadow-wit-emerald-hover hover:border-white/20 after:absolute after:inset-0 after:content-[''] after:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_50%)] after:opacity-0 after:transition-opacity after:duration-300 group-hover:after:opacity-100"
          >
            <span className="text-5xl mb-6 inline-block animate-float">🏢</span>
            <h2 className="text-2xl font-bold mb-3">空の上から (Skyscraper)</h2>
            <p className="text-wit-muted text-[15px] leading-relaxed flex-grow mb-6">
              外枠の数字をヒントに、重なり合うビルの高さを推理する本格派パズル。迷った時は「メイビー蜂さん」の力を借りて、論理の糸口を掴もう。
            </p>
            <div className="flex items-center justify-center gap-2 bg-wit-emerald text-white py-3 px-6 rounded-xl font-bold text-base w-full transition-colors group-hover:bg-emerald-600">
              出航する（Play）
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </Link>

          <Link
            href="/games/pres-sure-judge"
            className="group relative flex flex-col rounded-[20px] p-8 overflow-hidden no-underline text-wit-text border border-[var(--wit-border)] bg-[var(--wit-card-bg)] backdrop-blur-[10px] transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] hover:-translate-y-2 hover:shadow-wit-card-hover hover:border-white/20 after:absolute after:inset-0 after:content-[''] after:bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.15),transparent_50%)] after:opacity-0 after:transition-opacity after:duration-300 group-hover:after:opacity-100"
          >
            <span className="text-5xl mb-6 inline-block animate-float">⚖️</span>
            <h2 className="text-2xl font-bold mb-3">Pres-Sure Judge</h2>
            <p className="text-wit-muted text-[15px] leading-relaxed flex-grow mb-6">
              NPCが重りを載せるたびに天秤が傾く。10秒以内に重りで均衡を保て。判定ミスは累積するサバイバルゲーム。
            </p>
            <div className="flex items-center justify-center gap-2 bg-amber-500 text-black py-3 px-6 rounded-xl font-bold text-base w-full transition-colors group-hover:bg-amber-600">
              挑戦する（Play）
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </Link>
        </section>

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
