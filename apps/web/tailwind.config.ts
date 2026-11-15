import type { Config } from "tailwindcss";
import { designTokens } from "@utn/shared/design-tokens";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      ...designTokens,
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-plus-jakarta)", "var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 16px 40px -24px rgba(15, 23, 42, 0.24)",
        floating: "0 24px 70px -24px rgba(15, 23, 42, 0.45)",
        "emerald-glow": "0 0 0 1px rgba(16, 185, 129, 0.2), 0 18px 50px -20px rgba(16, 185, 129, 0.5)",
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "ring-pulse": {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%": { opacity: "0.2", transform: "scale(1.06)" },
        },
      },
      animation: {
        marquee: "marquee 52s linear infinite",
        "float-slow": "float-slow 7s ease-in-out infinite",
        "fade-up": "fade-up 0.6s ease-out both",
        "ring-pulse": "ring-pulse 3.2s ease-in-out infinite",
      },
      backgroundImage: {
        "hero-grid":
          "linear-gradient(to right, rgba(226, 232, 240, 0.65) 1px, transparent 1px), linear-gradient(to bottom, rgba(226, 232, 240, 0.65) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

export default config;
