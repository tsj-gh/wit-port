import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";

/** 各ラボ／ゲームページの title / description（知育目的を明示） */
export const gameLabPageSeo = {
  tapColoring: {
    title: "タップぬりえ | 直感と論理を育む知育パズル Wispo",
    description:
      "ブラウザで遊べる無料のタップぬりえ。線画にタップで色を塗り、因果理解・色彩認知を楽しく鍛えられます。知育効果と遊び方の解説付き。",
  },
  popPopBubbles: {
    title: "はじけて！バブル（Pop-Pop Bubbles） | 直感と論理を育む知育パズル Wispo",
    description:
      "はじけて！バブルの知育効果と遊び方。手眼協調と注意切替を鍛えるための専門的な設計について解説します。",
  },
  pairLink: {
    title: "Pair-Link（ペアリンク） | 直感と論理を育む知育パズル Wispo",
    description:
      "Pair-Link（ペアリンク）の知育効果と遊び方。論理的推論とワーキングメモリを鍛えるための専門的な設計について解説します。",
  },
  presSureJudge: {
    title: "Pres-Sure Judge（プレッシャージャッジ） | 直感と論理を育む知育パズル Wispo",
    description:
      "Pres-Sure Judge の知育効果と遊び方。数量判断と抑制制御を鍛えるための専門的な設計について解説します。",
  },
  skyscraper: {
    title: "Skyscraper（スカイスクレイパー） | 直感と論理を育む知育パズル Wispo",
    description:
      "Skyscraper（スカイスクレイパー）の知育効果と遊び方。空間把握と演繹推論を鍛えるための専門的な設計について解説します。",
  },
  reflecShot: {
    title: "Reflec-Shot（リフレクショット） | 直感と論理を育む知育パズル Wispo",
    description:
      "Reflec-Shot（リフレクショット）の知育効果と遊び方。空間推理と物理的予測を鍛えるための専門的な設計について解説します。",
  },
  hiddenStack: {
    title: "Hidden Stack（かくれつみき） | 直感と論理を育む知育パズル Wispo",
    description:
      "3D の積み木の死角を推測する Hidden Stack（かくれつみき）プロトタイプ。限定角度からの観察と空間推論を組み合わせた知育ラボ向け教材です。",
  },
} as const;

export function gameLabAlternates(path: `/${string}`): Metadata["alternates"] {
  return { canonical: `${BASE_URL}${path}` };
}
