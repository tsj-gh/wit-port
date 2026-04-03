import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { EducationalColumnWispoHeader } from "@/components/educational/EducationalColumnWispoHeader";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";

export const metadata: Metadata = {
  title: "知育コラム：Pair-Link・Reflec-Shot・Skyscraper・Pres-Sure Judge の知育効果",
  description:
    "Pair-Link・Reflec-Shot・Skyscraper・Pres-Sure Judge（プレッシャージャッジ）の知育効果を、脳科学・モンテッソーリ教育・難易度設計の観点から体系的に解説する固定ページ。",
  keywords: ["知育", "モンテッソーリ", "ロジックパズル", "前頭前野", "自己教育", "Wispo"],
  alternates: { canonical: `${BASE_URL}/columns/educational-value` },
};

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-12 scroll-mt-24 border-b border-white/10 pb-2 text-xl font-bold text-wit-text first:mt-0">
      {children}
    </h2>
  );
}

function PlayLink({ href, label }: { href: string; label: string }) {
  return (
    <p className="mt-6">
      <Link
        href={href}
        className="inline-flex items-center rounded-lg border border-sky-500/50 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-200 transition-colors hover:bg-sky-500/25"
      >
        {label}
      </Link>
    </p>
  );
}

export default function EducationalValueColumnPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 pb-16 md:py-14">
      <Suspense fallback={<div className="mb-8 h-9 w-40 rounded-lg bg-white/5" aria-hidden />}>
        <EducationalColumnWispoHeader />
      </Suspense>
      <article className="text-sm leading-relaxed text-wit-muted md:text-base">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-wit-muted">知育コラム</p>
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-wit-text md:text-3xl">
          知育コラム：デジタル・ロジックパズルと子どもの思考力
        </h1>

        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="text-lg font-semibold text-wit-text">はじめに：インタラクティブな環境とモンテッソーリの自己教育</h2>
          <p>
            Wispo が目指すのは、デジタル技術がもたらす<strong className="text-wit-text">即時フィードバック・段階的課題提示・安全な試行錯誤</strong>
            と、モンテッソーリ教育が重んじる<strong className="text-wit-text">自己教育（auto-education）</strong>および
            <strong className="text-wit-text">準備された環境（prepared environment）</strong>の考え方を、同一の遊び体験の中で接続することです。
          </p>
          <p>
            ソフトウェアは児童を評価するのではなく、規則を一貫して適用する「透明な環境」として振る舞います。課題生成や難易度カーブの設計にはアルゴリズムとデータ構造の知見が用いられますが、教育理論の観点から見れば、それは成人が子どもの発達段階に応じて教具と課題を整序する営みの延長です。
            流行の教育用語に追随するのではなく、<strong className="text-wit-text">試行・誤り・訂正のサイクル</strong>、
            <strong className="text-wit-text">秩序と集中</strong>、<strong className="text-wit-text">達成感に支えられた自律性</strong>といった、時を経ても色褪せない原理に立脚しています。
          </p>
          <p>
            以下では、当サイトで提供する主なコンテンツ（Pair-Link・Reflec-Shot・Skyscraper・Pres-Sure Judge など）を題材に、開発意図・認知神経科学的観点・モンテッソーリ的実践・難易度設計を横断的に整理します。保護者・教育者が家庭や教室で伴走する際の「対話の材料」としてご活用ください。
          </p>
        </section>

        <nav
          className="mt-10 rounded-xl border border-white/10 bg-black/20 p-4 text-wit-text"
          aria-label="コラム目次"
        >
          <p className="mb-2 text-xs font-semibold text-wit-muted">目次</p>
          <ul className="list-inside list-disc space-y-1 text-sm">
            <li>
              <a href="#pair-link" className="text-sky-300 hover:underline">
                Pair-Link（ペアリンク）
              </a>
            </li>
            <li>
              <a href="#reflec-shot" className="text-sky-300 hover:underline">
                Reflec-Shot（リフレクショット）
              </a>
            </li>
            <li>
              <a href="#skyscraper" className="text-sky-300 hover:underline">
                Skyscraper（スカイスクレイパー）
              </a>
            </li>
            <li>
              <a href="#pres-sure" className="text-sky-300 hover:underline">
                Pres-Sure Judge（プレッシャージャッジ）
              </a>
            </li>
          </ul>
        </nav>

        <SectionTitle id="pair-link">1. Pair-Link（ペアリンク）</SectionTitle>
        <h3 className="mt-4 font-semibold text-wit-text">開発背景</h3>
        <p>
          同値の端点を一方通行の線で結び、全マスを覆い、線同士が交差しないという制約は、紙面パズルとして長く親しまれてきました。デジタル化の意義は、描画・撤回・再試行のコストを極小化し、思考のリズムを途切れさせないことにあります。指やスタイラス操作は微細運動と空間表象を結び、学童期の図形・表現活動とも連関します。
        </p>
        <h3 className="mt-4 font-semibold text-wit-text">脳科学的視点</h3>
        <p>
          交差禁止と全盘充填という二重制約下での探索は、前頭前野が担う誤り予測と戦略更新を繰り返し刺激します。仮の経路をワーキングメモリに保持しつつ数手先の行き詰まりを先読みする過程は、視空間ワーキングメモリの負荷を伴い、地図読取や展開図思考と同系の認知過程を介します。適切な難易度での反復は、探索パターンの選別（スキーマ化）を促すと考えられます。
        </p>
        <h3 className="mt-4 font-semibold text-wit-text">モンテッソーリ教育との接点</h3>
        <p>
          簡潔なデモンストレーションで秩序（交差しない・余白を残さない）のみを示し、経路発見は児童に委ねる構成は、教師主導の手取り足取りを避けつつ自己教育へ橋渡しします。ルール違反が即座に操作として返ることは、外部評価に依存しない誤り訂正の機会となります。
        </p>
        <h3 className="mt-4 font-semibold text-wit-text">ステップアップ設計</h3>
        <p>
          グレード（G1〜）により盤面規模と対ペア数、生成上の制約が段階的に増えます。入門で成功体験を固め、高次で探索空間を拡大する勾配は、準備された難易度という観点から妥当です。線をグラフの辺とみなす視点は、将来の離散数学的直観の下地にもなり得ます。
        </p>
        <PlayLink href="/lab/pair-link" label="このパズルを今すぐ遊ぶ（Pair-Link・ペアリンク）" />

        <SectionTitle id="reflec-shot">2. Reflec-Shot（リフレクショット）</SectionTitle>
        <h3 className="mt-4 font-semibold text-wit-text">開発背景</h3>
        <p>
          鏡の反射は具体的操作として魅力的ですが、実験環境の準備と再現性の確保にはコストが伴います。格子・壁・バンパー記号（／＼－｜）へ抽象化しデジタル上で等速移動と反射規則を誤差なく再現することで、幾何直感と記号的推論の往復を安全に繰り返せます。
        </p>
        <h3 className="mt-4 font-semibold text-wit-text">脳科学的視点</h3>
        <p>
          軌道結果が明瞭に返る課題は行動結果監視を反復します。方向転換の系列保持はワーキングメモリ負荷を伴い、長押し後のスワイプでバンパー種を確定させる操作は運動計画と短時間の戦略決定を結びます。認知的柔軟性の訓練に近い性質が期待されます。
        </p>
        <h3 className="mt-4 font-semibold text-wit-text">モンテッソーリ教育との接点</h3>
        <p>
          失敗条件（壁向き進行、スタート帰還、ゴール未達など）が画面上で一義的に示されることは、誤りが環境から明らかになる教具設計の原則と響き合います。児童は規則を自分の操作と照合し、大人の都度介入を減じた自己評価へ向かいやすくなります。
        </p>
        <h3 className="mt-4 font-semibold text-wit-text">ステップアップ設計</h3>
        <p>
          グレード上昇に伴い盤面規模とバンパー配置の複雑さが増し、単純な直線予測から多段反射の推論へ移行します。低グレードの成功が自我の充実を支え、高グレードが持続的注意と計画の持続を求めます。ラボ公開は小規模な観察導入にも適します。
        </p>
        <PlayLink href="/lab/reflec-shot" label="このパズルを今すぐ遊ぶ（Reflec-Shot・リフレクショット・知育ラボ）" />

        <SectionTitle id="skyscraper">3. Skyscraper（スカイスクレイパー）</SectionTitle>
        <h3 className="mt-4 font-semibold text-wit-text">開発背景</h3>
        <p>
          各行・列に1〜Nを一度ずつ置き、外周ヒントが各方向の可視棟数と一致させる課題は、ラテン方陣性と可視カウントという二系統の論理を統合します。紙では消去の記述が煩雑になりがちですが、デジタルは仮置きと検証の反復を軽くし、制約推理そのものに注意を向けさせます。
        </p>
        <h3 className="mt-4 font-semibold text-wit-text">脳科学的視点</h3>
        <p>
          矛盾に至る配置は予測誤差処理を繰り返し刺激します。頭上視点の遮蔽関係を心内でシミュレートする過程は空間推論と数大小比較を結合します。メイビーモードによる仮置きはワーキングメモリの外部化として、仮説と確定の区別を学ぶ足場になります。
        </p>
        <h3 className="mt-4 font-semibold text-wit-text">モンテッソーリ教育との接点</h3>
        <p>
          秩序・正確さ・集中という自治区の精神に照らし、静かに操作が反映される盤面は外部秩序として心の秩序を支え得ます。メイビーは支援であり、判断の主役は常に児童であるというバランスが重要です。
        </p>
        <h3 className="mt-4 font-semibold text-wit-text">ステップアップ設計</h3>
        <p>
          盤サイズと難易プリセットにより探索空間を段階的に拡大します。小盤でヒントが強く効く型を体感的に蓄積し、大盤で複合制約への耐性を養う流れは、算数における場合分けの持久力とも通じます。
        </p>
        <PlayLink href="/lab/skyscraper" label="このパズルを今すぐ遊ぶ（Skyscraper・スカイスクレイパー）" />

        <SectionTitle id="pres-sure">4. Pres-Sure Judge（プレッシャージャッジ）</SectionTitle>
        <h3 className="mt-4 font-semibold text-wit-text">開発背景</h3>
        <p>
          NPC が先に重りを載せ、プレイヤーは在庫からドラッグして天秤の皿へ配置し、制限時間内に均衡を保つという課題は、紙教材では時間圧と連続的な視覚フィードバックを同時に再現しにくい領域です。デジタル化により傾きと残り時間が同期し、誤判断が即座に盤面へ反映されます。判定ミスやタイムアウトがラウンドを通じて累積するサバイバル構造は、単発の正誤より戦略の持続と自己調整を問う意図に基づき、数の大小・空間配置・タイミングを一体の行為として反復できるように設計されています。
        </p>
        <h3 className="mt-4 font-semibold text-wit-text">脳科学的視点</h3>
        <p>
          短い時間窓で載せ先・載せる重り・Judge（確定）のタイミングを決める過程は、前頭前野が担う実行機能、特に抑制制御と状況の迅速な更新を繰り返し刺激します。動く天秤と指の軌道を対応づける操作は視空間運動統合を伴い、数値と左右のトルクのイメージをワーキングメモリに二重に保持する負荷が生じます。NPC の一手ごとに状態が書き換わるため予測誤差処理が高頻度で回り、ラウンドが進むにつれ覚醒と注意の維持にも課題が加わり、学童期以降の実行機能の持久力に近い訓練として位置づけられます。
        </p>
        <h3 className="mt-4 font-semibold text-wit-text">モンテッソーリ教育との接点</h3>
        <p>
          天秤の傾きは具体的教具に近い因果として児童の感覚・運動と結びつき、抽象的レクチャーより先に身体化された理解を促します。誤配置やタイムアウトの即時可視化は、叱責ではなく環境からのフィードバックとして自己訂正を支えます。NPC の挙動は他者の操作のデジタル的代理として機能し、「他者の行為のあとに自分がどう応答するか」という社会的文脈を薄いレイヤーで経験させます。成人の過度な口出しを減じ、結果が環境に返る構造は自己教育の原則と整合します。
        </p>
        <h3 className="mt-4 font-semibold text-wit-text">ステップアップ設計</h3>
        <p>
          ラウンド進行に伴い NPC の出方や在庫の緊張度が変化し、一枚比較から数手先の均衡イメージを要する局面へ移行します。Judge 操作は連続微調整に流されず判断の区切りを明示し、衝動と推理を分離する習慣づけに寄与します。難易度が段階的に上がることで準備された負荷勾配を保ち、ロジックパズルとは異なる軸として数・時間・身体操作を統合した知育体験を提供します。
        </p>
        <PlayLink href="/lab/pres-sure-judge" label="このパズルを今すぐ遊ぶ（Pres-Sure Judge・プレッシャージャッジ）" />

        <p className="mt-12 border-t border-white/10 pt-8 text-center text-xs text-wit-muted">
          <Link href="/" className="text-sky-300 hover:underline">
            トップページへ戻る
          </Link>
        </p>
      </article>
    </main>
  );
}
