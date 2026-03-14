import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "wit-bg": "#0b1020",
        "wit-bg-2": "#111827",
        "wit-text": "#f8fafc",
        "wit-muted": "#94a3b8",
        "wit-accent": "#3b82f6",
        "wit-emerald": "#10b981",
      },
      fontFamily: {
        sans: [
          "Helvetica Neue",
          "Arial",
          "Hiragino Kaku Gothic ProN",
          "Hiragino Sans",
          "Meiryo",
          "sans-serif",
        ],
      },
      animation: {
        "fade-in-up": "fadeInUp 0.8s ease-out forwards",
        "fade-in-up-delay": "fadeInUp 1s ease-out 0.2s backwards",
        "fade-in-up-delay-more": "fadeInUp 1s ease-out 0.4s backwards",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      boxShadow: {
        "wit-glow": "0 0 20px rgba(59, 130, 246, 0.5)",
        "wit-card-hover": "0 20px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(59, 130, 246, 0.5)",
        "wit-emerald-hover": "0 20px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(16, 185, 129, 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
