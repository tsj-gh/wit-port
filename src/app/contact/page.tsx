import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description:
    "Wit-Spotへのお問い合わせは、こちらのフォームよりお送りください。",
  keywords: ["知育", "パズル", "無料", "お問い合わせ"],
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-[680px] w-full px-6">
      <header className="flex justify-between items-center py-8">
        <Link
          href="/"
          className="flex items-center gap-3 text-[28px] font-black tracking-[2px] text-wit-text no-underline hover:opacity-90"
        >
          <span className="block w-8 h-8 rounded-lg bg-gradient-to-br from-wit-accent to-purple-500 shadow-[0_0_15px_var(--wit-accent-glow)]" />
          Wit-Spot
        </Link>
        <Link
          href="/"
          className="text-wit-muted text-sm no-underline hover:text-wit-text transition-colors"
        >
          ← トップへ戻る
        </Link>
      </header>

      <main className="pb-20">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-wit-text">
          お問い合わせ
        </h1>
        <p className="text-wit-muted text-[15px] leading-relaxed mb-8">
          ご質問、不具合報告は、以下のフォームよりお送りください。
        </p>

        <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur">
          <iframe
            src="https://docs.google.com/forms/d/e/1FAIpQLSdT4fq8tjaTrGe0uojoix3OfNzAeJ5Hzq1Aal92OF0QGINTEw/viewform?embedded=true"
            width="100%"
            height="857"
            frameBorder={0}
            marginHeight={0}
            marginWidth={0}
            title="お問い合わせフォーム"
            className="min-h-[800px] w-full"
          >
            読み込んでいます…
          </iframe>
        </div>

        <p className="text-center mt-6">
          <Link
            href="/"
            className="inline-block px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-wit-text no-underline text-sm font-medium hover:bg-white/15 transition-colors"
          >
            トップへ戻る
          </Link>
        </p>
      </main>
    </div>
  );
}
