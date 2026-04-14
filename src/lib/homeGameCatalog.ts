/**
 * トップページのゲーム一覧（セクション ID とカードの対応のみ保持。
 * 文言は locales の `home.*`、見出しは特定ゲーム名を含まない。）
 */
export type HomePlaySectionId = "intuition" | "logical" | "strategic";

export type HomeGameCardId = "tap-coloring" | "pair-link" | "pres-sure-judge" | "skyscraper" | "reflec-shot";

export type HomeGameCardDef = {
  id: HomeGameCardId;
  href: string;
  titleKey: string;
  tooltipKey: string;
  emoji: string;
};

export const HOME_GAME_CARDS: Record<HomeGameCardId, HomeGameCardDef> = {
  "tap-coloring": {
    id: "tap-coloring",
    href: "/lab/tap-coloring",
    titleKey: "home.cardTapColoringTitle",
    tooltipKey: "home.cardTapColoringTip",
    emoji: "🖍️",
  },
  "pair-link": {
    id: "pair-link",
    href: "/lab/pair-link",
    titleKey: "home.cardPairLinkTitle",
    tooltipKey: "home.cardPairLinkTip",
    emoji: "✨",
  },
  "pres-sure-judge": {
    id: "pres-sure-judge",
    href: "/lab/pres-sure-judge",
    titleKey: "home.cardPresTitle",
    tooltipKey: "home.cardPresTip",
    emoji: "⚖️",
  },
  skyscraper: {
    id: "skyscraper",
    href: "/lab/skyscraper",
    titleKey: "home.cardSkyTitle",
    tooltipKey: "home.cardSkyTip",
    emoji: "🏢",
  },
  "reflec-shot": {
    id: "reflec-shot",
    href: "/lab/reflec-shot",
    titleKey: "home.cardReflecTitle",
    tooltipKey: "home.cardReflecTip",
    emoji: "🪞",
  },
};

export type HomeGameSectionDef = {
  id: HomePlaySectionId;
  titleKey: string;
  cardIds: readonly HomeGameCardId[];
};

export const HOME_GAME_SECTIONS: readonly HomeGameSectionDef[] = [
  {
    id: "intuition",
    titleKey: "home.sectionIntuitionTitle",
    cardIds: ["tap-coloring"],
  },
  {
    id: "logical",
    titleKey: "home.sectionLogicalTitle",
    cardIds: ["pair-link", "pres-sure-judge"],
  },
  {
    id: "strategic",
    titleKey: "home.sectionStrategicTitle",
    cardIds: ["skyscraper", "reflec-shot"],
  },
];
