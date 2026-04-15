type SupportedGameAppId =
  | "tap-coloring"
  | "pair-link"
  | "pres-sure-judge"
  | "skyscraper"
  | "reflec-shot";

type GameJsonLdSeed = {
  name: string;
  path: `/${string}`;
  description: string;
  featureList: string[];
};

const GAME_JSONLD_SEEDS: Record<SupportedGameAppId, GameJsonLdSeed> = {
  "tap-coloring": {
    name: "タップぬりえ",
    path: "/lab/tap-coloring",
    description:
      "タップ入力による即時フィードバックを通じ、色彩選択と因果理解を同時に育てる知育アプリです。手眼協調、注意の持続、自己修正の習慣化を段階的に促します。",
    featureList: ["手眼協調", "色彩認知", "因果理解", "注意の持続", "幼児向け直感操作"],
  },
  "pair-link": {
    name: "Pair-Link（ペアリンク）",
    path: "/lab/pair-link",
    description:
      "交差禁止と全マス充填という二重制約を解く過程で、論理的推論・ワーキングメモリ・先読み計画を鍛える知育パズルです。試行錯誤を自己修正へつなげます。",
    featureList: ["論理的推論", "ワーキングメモリ", "経路計画", "制約充足", "自己修正学習"],
  },
  "pres-sure-judge": {
    name: "Pres-Sure Judge（プレッシャージャッジ）",
    path: "/lab/pres-sure-judge",
    description:
      "時間制約下で天秤の均衡を判断することで、数量感覚・抑制制御・意思決定を統合的に訓練する知育ゲームです。運動操作と認知負荷の連携を設計しています。",
    featureList: ["数量感覚", "抑制制御", "意思決定", "時間制約タスク", "非認知能力"],
  },
  skyscraper: {
    name: "Skyscraper（スカイスクレイパー）",
    path: "/lab/skyscraper",
    description:
      "外周ヒントから内部配置を推理する課題設計により、空間把握・演繹推論・仮説検証の循環を促す知育パズルです。誤りの可視化で自己調整学習を支援します。",
    featureList: ["空間把握", "演繹推論", "仮説検証", "数理的思考", "自己調整学習"],
  },
  "reflec-shot": {
    name: "Reflec-Shot（リフレクショット）",
    path: "/lab/reflec-shot",
    description:
      "反射規則と軌道予測を扱う物理シミュレーション型課題として、空間推理・系列保持・戦略更新を鍛える知育ラボです。直感と記号操作の往復学習を実現します。",
    featureList: ["物理シミュレーション", "空間推理", "軌道予測", "戦略更新", "系列保持"],
  },
};

export function buildGameSoftwareApplicationJsonLd(
  gameId: SupportedGameAppId,
  siteUrl: string
): Record<string, unknown> {
  const base = siteUrl.replace(/\/$/, "");
  const seed = GAME_JSONLD_SEEDS[gameId];

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: seed.name,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web Browser",
    description: seed.description,
    url: `${base}${seed.path}`,
    featureList: seed.featureList,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "JPY",
      availability: "https://schema.org/InStock",
    },
    provider: {
      "@type": "Organization",
      name: "Wispo",
      url: base,
    },
  };
}
