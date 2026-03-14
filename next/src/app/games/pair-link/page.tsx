import type { Metadata } from "next";
import PairLinkGame from "./PairLinkGame";

export const metadata: Metadata = {
  title: "ペアリンク（ナンバーリンク）",
  description:
    "同じ数字を線で繋ぎ、盤面の全マスを埋める無料知育ロジックパズル。ドラッグでスムーズに線を引き、論理的思考力を育みます。",
  keywords: ["知育", "パズル", "無料", "ナンバーリンク", "ペアリンク", "ロジックパズル"],
};

export default function PairLinkPage() {
  return (
    <>
      <PairLinkGame />
      <section className="mx-auto max-w-[1080px] w-full px-4 py-6 pb-12">
        <div className="rounded-2xl p-6 sm:p-8 border border-white/10 bg-white/5 backdrop-blur space-y-6">
          <h2 className="text-lg font-bold text-wit-text">ペアリンクの遊び方</h2>
          <p className="text-wit-muted text-sm leading-relaxed">
            ペアリンク（ナンバーリンク）は、盤面上に散らばった同じ数字同士を、線で結んでいくロジックパズルです。ルールはシンプルながら奥が深く、子どもから大人まで楽しめます。同じ数字のマスをタップまたはドラッグで線で繋いでいき、盤面の全マスを隙間なく埋められればクリアです。線は交差してはいけません。また、1つのマスには1本の線しか通れません。4×4の入門サイズから10×10の上級まで、難易度を選んで挑戦できます。直感と論理の両方を使うため、集中力と計画性が養われます。
          </p>

          <h2 className="text-lg font-bold text-wit-text">知育効果</h2>
          <p className="text-wit-muted text-sm leading-relaxed">
            ペアリンクは、空間認識力・論理的思考力・先読み力の発達に効果的です。盤面全体を見渡し、どの数字から繋ぐと効率的か、どこで行き止まりになるかを考えることで、計画的な思考が身につきます。また、線が交差しないよう経路を工夫する過程で、空間的推論能力が鍛えられます。小学校低学年から高学年、さらには大人の脳トレにも最適です。無料で何度でも遊べるため、日常生活の隙間時間に気軽に取り組め、継続的な知育効果が期待できます。
          </p>
        </div>
      </section>
    </>
  );
}
