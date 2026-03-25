import type { Metadata } from "next";
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
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 md:py-12">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-wit-muted mb-2">知育ラボ</p>
        <h1 className="text-2xl md:text-3xl font-bold text-wit-text tracking-tight">Reflec-Shot（リフレクショット）</h1>
        <p className="mt-2 text-wit-muted text-sm leading-relaxed">
          プロトタイプ（MVP）。ステージは自動生成（ランクで反射回数が変化）。マウスはスリングショット、タッチは長押しチャージ＆スワイプで射出し、紫のゴールへ導きます。
        </p>
      </div>
      <ReflecShotGame />
    </main>
  );
}
