export const SITE_THEMES = {
  paperCraft: {
    name: "Paper & Craft",
    colors: {
      bg: "#F9F7F2",
      surface: "#E0D7C6",
      primary: "#D97757",
      text: "#333333",
      accent: "#A68D74",
    },
  },
  botanicalSport: {
    name: "Botanical Sport",
    colors: {
      bg: "#EDF2EE",
      surface: "#FFFFFF",
      primary: "#2D5A27",
      text: "#1A2A3A",
      accent: "#E3B04B",
    },
  },
  blueprintLibrary: {
    name: "Blueprint Library",
    colors: {
      bg: "#F0F4F8",
      surface: "#D1D9E0",
      primary: "#3E5F8A",
      text: "#102A43",
      accent: "#547194",
    },
  },
} as const;

export type SiteThemeId = keyof typeof SITE_THEMES;

export const SITE_THEME_IDS: SiteThemeId[] = [
  "paperCraft",
  "botanicalSport",
  "blueprintLibrary",
];
