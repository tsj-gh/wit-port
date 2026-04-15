/**
 * サイト全体の SoftwareApplication 構造化データ（JSON-LD）。
 * AdSense / 検索向けに、各ゲームを hasPart で列挙する。
 */
export function buildWispoSoftwareApplicationJsonLd(siteUrl: string): Record<string, unknown> {
  const base = siteUrl.replace(/\/$/, "");

  const freeOffer = {
    "@type": "Offer",
    price: "0",
    priceCurrency: "JPY",
    availability: "https://schema.org/InStock",
  };

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Wispo (ウィスポ)",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web Browser",
    description:
      "モンテッソーリ教育の視点を取り入れた、直感と論理を育む知育パズルプラットフォーム。",
    url: base,
    offers: freeOffer,
    provider: {
      "@type": "Organization",
      name: "Wispo",
      url: base,
    },
    hasPart: [
      {
        "@type": "SoftwareApplication",
        name: "タップぬりえ",
        url: `${base}/lab/tap-coloring`,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web Browser",
        description:
          "タップで色がふわっと広がる幼児向けの直感ぬりえ。原因と結果を楽しく体験し、色彩と集中を育みます。",
        featureList: ["直感操作", "原因と結果", "色彩の遊び", "幼児向け知育", "ブラウザで無料"],
        offers: freeOffer,
      },
      {
        "@type": "SoftwareApplication",
        name: "はじけて！バブル（Pop-Pop Bubbles）",
        url: `${base}/lab/pop-pop-bubbles`,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web Browser",
        description:
          "ふわふわ漂うバブルをタップして弾ける、Kids向けの軽い知育プレイ。手眼協調と反応の楽しさを重ねます。",
        featureList: ["手眼協調", "反応と集中", "直感的タッチ", "幼児向け", "無料"],
        offers: freeOffer,
      },
      {
        "@type": "SoftwareApplication",
        name: "Pair-Link（ペアリンク）",
        url: `${base}/lab/pair-link`,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web Browser",
        description:
          "同じ数字を交差しない線でつなぐロジックパズル。試行錯誤しながら盤面を埋め、論理的思考力を育みます。",
        featureList: ["論理的思考", "経路推理", "試行錯誤", "算数的発想", "無料"],
        offers: freeOffer,
      },
      {
        "@type": "SoftwareApplication",
        name: "Pres-Sure Judge（プレッシャージャッジ）",
        url: `${base}/lab/pres-sure-judge`,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web Browser",
        description:
          "天秤のバランスを短時間で見極める判断ゲーム。重りの配置とタイミングから、数量感覚と意思決定を鍛えます。",
        featureList: ["バランス判断", "時間制限下の集中", "数量感覚", "意思決定", "無料"],
        offers: freeOffer,
      },
      {
        "@type": "SoftwareApplication",
        name: "Skyscraper（スカイスクレイパー）",
        url: `${base}/lab/skyscraper`,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web Browser",
        description:
          "外枠の数字を手がかりにビルの高さを推理する本格パズル。制約を積み上げる論理の筋道を体験できます。",
        featureList: ["制約充足", "論理の積み上げ", "数感", "本格ロジックパズル", "無料"],
        offers: freeOffer,
      },
      {
        "@type": "SoftwareApplication",
        name: "Reflec-Shot（リフレクショット）",
        url: `${base}/lab/reflec-shot`,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web Browser",
        description:
          "反射の向きを予測してゴールを目指す空間パズル。軌道を読む感覚と幾何の直感を養う知育ラボ向けコンテンツです。",
        featureList: ["空間推理", "反射と角度", "軌道の予測", "幾何直感", "無料"],
        offers: freeOffer,
      },
    ],
  };
}
