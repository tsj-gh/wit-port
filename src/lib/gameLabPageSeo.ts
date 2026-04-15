import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";

/** 各ラボ／ゲームページの title / description（知育目的を明示） */
export const gameLabPageSeo = {
  tapColoring: {
    title: "タップぬりえ | 原因と結果・色彩の直感を育む知育プレイ（Wispo）",
    description:
      "タップで色が広がる幼児向けぬりえ。因果の体験と色彩遊びを通して集中と感覚を育てる、モンテッソーリ的視点の知育コンテンツです。",
  },
  popPopBubbles: {
    title: "はじけて！バブル（Pop-Pop Bubbles）| 手眼協調と反応の知育ミニゲーム | Wispo",
    description:
      "漂うバブルをタップして弾ける軽いプレイ。視線と指の協調、短い集中のリズムを楽しみながら養えるKids向け知育ゲームです。",
  },
  pairLink: {
    title: "Pair-Link（ペアリンク）| 経路推理と論理で盤面を埋める知育パズル | Wispo",
    description:
      "同じ数字を交差しない線でつなぎ、全マスを埋める無料知育ロジックパズル。試行錯誤と制約思考で算数的・論理的思考力を育みます。",
  },
  presSureJudge: {
    title: "Pres-Sure Judge（プレッシャージャッジ）| 天秤と時間で判断力を鍛える知育ゲーム | Wispo",
    description:
      "NPCの重りと自分の重りの均衡を短時間で保つサバイバル型バランスゲーム。数量感覚・タイミング判断・集中を知育的に鍛えます。",
  },
  skyscraper: {
    title: "Skyscraper（スカイスクレイパー）| 外枠ヒントから高さを推理する知育パズル | Wispo",
    description:
      "外枠の数字をヒントにビルの高さを推理する無料知育パズル。制約を積み上げる論理の筋道と数感の育成を目的とした本格ロジックです。",
  },
  reflecShot: {
    title: "Reflec-Shot（リフレクショット）知育ラボ | 反射と軌道で空間推理を育む | Wispo",
    description:
      "反射の向きを予測しゴールへ導く空間パズル。幾何の直感と記号的操作を短いフィードバックで繰り返し、知育ラボ向けに設計されています。",
  },
} as const;

export function gameLabAlternates(path: `/${string}`): Metadata["alternates"] {
  return { canonical: `${BASE_URL}${path}` };
}
