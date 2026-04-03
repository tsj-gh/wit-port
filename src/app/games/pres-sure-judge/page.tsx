import type { Metadata } from "next";
import { Suspense } from "react";
import { EducationalValueSection } from "@/components/educational/EducationalValueSection";
import PresSureJudgeGame from "./PresSureJudgeGame";

export const metadata: Metadata = {
  title: "Pres-Sure Judge（プレッシャージャッジ）",
  description:
    "NPCの重りvs自分の重り。10秒以内に均衡を保て。判定ミスは累積するサバイバル・バランシングゲーム。",
  keywords: ["知育", "パズル", "無料", "バランス", "サバイバル", "タイムアタック"],
};

export default function PresSureJudgePage() {
  return (
    <>
      <Suspense fallback={null}>
        <PresSureJudgeGame />
      </Suspense>
      <EducationalValueSection summaryLabel="このゲームの知育効果について（専門解説・知育コラム連携）">
        <h3>開発背景</h3>
        <p>
          Pres-Sure Judge は、NPC が先に重りを載せ、プレイヤーは与えられた在庫から重りをドラッグして天秤の左右の皿へ配置し、制限時間内に均衡を保つという、
          <strong className="text-wit-text">時間圧の下での連続判断</strong>
          を核とする知育ゲームです。紙や静止画では「今まさに傾きつつある秤」と「残り秒数」を同時に体感させにくく、誤判断の帰結も段階的に蓄積しづらい領域でした。ブラウザ上で物理に近いフィードバックとタイマーを同期させることで、数の大小・配置・タイミングを
          <strong className="text-wit-text">一連の行為として反復</strong>
          できるようにデジタル化しています。判定ミスやタイムアウトがラウンドを通じて累積するサバイバル構造は、単発の正誤よりも
          <strong className="text-wit-text">戦略の持続と自己調整</strong>
          を問う意図に基づきます。
        </p>
        <h3>脳科学的視点</h3>
        <p>
          短い時間窓のなかで「載せる／載せない」「どちらの皿か」「いつ Judge（確定）するか」を決める課題は、
          <strong className="text-wit-text">前頭前野</strong>が関与する実行機能、とりわけ
          <strong className="text-wit-text">抑制制御</strong>（衝動的なタップや誤った確定を抑える）と状況の迅速な更新を繰り返し刺激します。視覚的に動く天秤と指の軌道を対応づける操作は視空間運動統合を伴い、各重りの数値と左右のトルクのイメージを
          <strong className="text-wit-text">ワーキングメモリ</strong>
          上で二重に保持する負荷が生じます。NPC の一手ごとに状態が書き換わるため、予測と結果のズレ（予測誤差）が高頻度で処理され、試行錯誤のループが前頭―皮質下回路を通じて強化されると考えられます。持続的なラウンド進行は覚醒と注意の維持にも課題を与え、学童期以降の
          <strong className="text-wit-text">実行機能の持久力</strong>
          に近い訓練として位置づけられます。
        </p>
        <h3>モンテッソーリ教育の融合</h3>
        <p>
          モンテッソーリが重んじる<strong className="text-wit-text">具体的教具に根ざした因果の理解</strong>
          に照らすと、天秤の傾きは抽象的な説明より先に、児童の感覚・運動と結びついた因果として返ります。画面という「整えられた環境」は、誤配置やタイムアウトを即座に可視化し、叱責に頼らない
          <strong className="text-wit-text">環境からのフィードバック</strong>
          を提供します。NPC の挙動は、成人が演示する他者の操作のデジタル的代理として機能し、児童は「他者の行為のあとに自分がどう応答するか」という薄いが明確な
          <strong className="text-wit-text">社会的文脈</strong>
          を経験します。保護者・教師が伴走する際は、結果を代弁するより「どの皿が重く見えたか」「次の一手で何を恐れているか」を言語化して共有することが、子どもの自己観察を支えます。
        </p>
        <h3>ステップアップの設計（ラウンドと難易度）</h3>
        <p>
          ラウンドが進むにつれ、NPC の重りの出方やプレイヤーが扱う在庫の緊張度が変化し、単純な一枚比較から
          <strong className="text-wit-text">数手先の均衡イメージ</strong>
          を要する局面へ移行します。<strong className="text-wit-text">Judge（確定）</strong>
          操作は、連続した微調整に流されず「ここで区切りをつける」というメタ判断を要求し、衝動と推理を分離する習慣づけに寄与します。難易度が段階的に上がることで、一度に過大な負荷をかけず
          <strong className="text-wit-text">準備された負荷勾配</strong>
          を保ちつつ、達成と失敗の両方から学びを抽出できるよう設計されています。ロジックパズル型タイトルとは異なる軸の課題として、数と時間・身体操作を統合した知育体験を提供します。
        </p>
      </EducationalValueSection>
    </>
  );
}
