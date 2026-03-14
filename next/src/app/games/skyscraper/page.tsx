import type { Metadata } from "next";
import SkyscraperGame from "./SkyscraperGame";

export const metadata: Metadata = {
  title: "空の上から（Skyscrapers）",
  description:
    "外枠の数字をヒントに、重なり合うビルの高さを推理する無料知育パズル。メイビー蜂さんの力で論理の糸口を掴もう。",
  keywords: ["知育", "パズル", "無料", "スカイスクレイパー", "ビルパズル", "ロジックパズル"],
};

export default function SkyscraperPage() {
  return (
    <>
      <SkyscraperGame />
      <section className="mx-auto max-w-[1080px] w-full px-4 py-6 pb-12">
        <div className="rounded-2xl p-6 sm:p-8 border border-white/10 bg-white/5 backdrop-blur space-y-6">
          <h2 className="text-lg font-bold text-wit-text">空の上から（スカイスクレイパー）の遊び方</h2>
          <p className="text-wit-muted text-sm leading-relaxed">
            スカイスクレイパーは、グリッド上にビルの高さ（1〜N）を配置するロジックパズルです。4辺に書かれた数字がヒントで、その方向から見たときに「いくつのビルが見えるか」を表しています。手前から順に、より高いビルが現れるたびに見える本数が1つ増えます。各行・各列に1〜Nの数字が1つずつ入るルール（ラテン方陣）を満たしつつ、すべてのヒントと矛盾しないようにマスを埋めていきます。メイビー蜂さんの「メイビーモード」では、仮の数字を試しながら推論を進められるため、難しい問題にも挑戦しやすくなっています。
          </p>

          <h2 className="text-lg font-bold text-wit-text">知育効果</h2>
          <p className="text-wit-muted text-sm leading-relaxed">
            スカイスクレイパーは、論理的推論力・制約充足の理解・数的センスを養うのに適した知育パズルです。ヒントから「このマスにはこの数字しか入らない」といった確定パターンを見つけることで、消去法的思考が身につきます。また、複数の条件を同時に満たすよう試行錯誤する過程で、問題解決の戦略的思考が育まれます。小学校中学年以降から大人まで、段階的に難易度を上げて楽しめます。無料で繰り返しプレイでき、脳の活性化や集中力の維持にも役立ちます。
          </p>
        </div>
      </section>
    </>
  );
}
