/** サイト全体のカラーテーマ（13種）。`SiteThemeProvider` が CSS 変数へ展開 */
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
  montessoriWood: {
    name: "Montessori Wood",
    colors: {
      bg: "#FDFBF7",
      surface: "#D7BA8E",
      primary: "#8B5A2B",
      text: "#4E342E",
      accent: "#A1887F",
    },
  },
  midnightFocus: {
    name: "Midnight Focus",
    colors: {
      bg: "#121212",
      surface: "#1E1E1E",
      primary: "#BB86FC",
      text: "#E0D7C6",
      accent: "#03DAC6",
    },
  },
  sakuraSpring: {
    name: "Sakura Spring",
    colors: {
      bg: "#FFF5F7",
      surface: "#FFDEE4",
      primary: "#F06292",
      text: "#5D4037",
      accent: "#FF8A80",
    },
  },
  nordicOcean: {
    name: "Nordic Ocean",
    colors: {
      bg: "#EBF2F5",
      surface: "#CFDCE4",
      primary: "#4A7A8C",
      text: "#1A2A3A",
      accent: "#78909C",
    },
  },
  modernSlate: {
    name: "Modern Slate",
    colors: {
      bg: "#F2F2F2",
      surface: "#E0E0E0",
      primary: "#212121",
      text: "#424242",
      accent: "#757575",
    },
  },
  solarEnergy: {
    name: "Solar Energy",
    colors: {
      bg: "#FFFDE7",
      surface: "#FFF9C4",
      primary: "#FBC02D",
      text: "#5D4037",
      accent: "#FFA000",
    },
  },
  lavenderMist: {
    name: "Lavender Mist",
    colors: {
      bg: "#F3E5F5",
      surface: "#E1BEE7",
      primary: "#9C27B0",
      text: "#4A148C",
      accent: "#BA68C8",
    },
  },
  retroCanvas: {
    name: "Retro Canvas",
    colors: {
      bg: "#F5F5DC",
      surface: "#D2B48C",
      primary: "#5D4037",
      text: "#3E2723",
      accent: "#8D6E63",
    },
  },
  mintFresh: {
    name: "Mint Fresh",
    colors: {
      bg: "#E8F5E9",
      surface: "#C8E6C9",
      primary: "#43A047",
      text: "#1B5E20",
      accent: "#81C784",
    },
  },
  royalVelvet: {
    name: "Royal Velvet",
    colors: {
      bg: "#F8F9FA",
      surface: "#E9ECEF",
      primary: "#673AB7",
      text: "#311B92",
      accent: "#9575CD",
    },
  },
} as const;

export type SiteThemeId = keyof typeof SITE_THEMES;

export const SITE_THEME_IDS: SiteThemeId[] = [
  "paperCraft",
  "botanicalSport",
  "blueprintLibrary",
  "montessoriWood",
  "midnightFocus",
  "sakuraSpring",
  "nordicOcean",
  "modernSlate",
  "solarEnergy",
  "lavenderMist",
  "retroCanvas",
  "mintFresh",
  "royalVelvet",
];

/** primary 上に載せるテキスト色（明るい primary には暗色） */
export function pickOnPrimaryForHex(primaryHex: string): "#ffffff" | "#1a1a1a" {
  const h = primaryHex.replace(/^#/, "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (full.length !== 6) return "#ffffff";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return "#ffffff";
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  return lum > 0.55 ? "#1a1a1a" : "#ffffff";
}
