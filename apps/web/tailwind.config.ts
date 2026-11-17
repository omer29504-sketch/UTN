import type { Config } from "tailwindcss";
import { designTokens } from "@utn/shared/design-tokens";

/**
 * Web "Jewel Atelier" palette.
 *
 * A warm alabaster canvas, midnight-ink type, champagne hairlines, and four
 * jewel accents — emerald, sapphire, amethyst, and teal — that carry the
 * aurora signature into every surface. The canonical palette in
 * `@utn/shared/design-tokens` is consumed by the shared packages; the web
 * surface keeps its own explicit colour map here so a token change cannot
 * silently recolour the product. Gradients and the aurora live in
 * `globals.css` as custom properties.
 */
const colors = {
  brand: {
    navy: "#070F24",
    "navy-soft": "#0E1B3D",
    "navy-line": "#1D2C55",
  },
  surface: {
    canvas: "#F7F3EB",
    card: "#FFFCF7",
    muted: "#F0E8DA",
    elevated: "#FFFFFF",
  },
  accent: {
    emerald: "#0E9F6E",
    "emerald-hover": "#0B7F58",
    "emerald-soft": "#E6F6EF",
    gold: "#C8A45D",
    // Deep enough to clear 4.5:1 as small text on ivory, still unmistakably gold.
    "gold-hover": "#8A6626",
    "gold-soft": "#F8F0DE",
    sapphire: "#3B5BFF",
    "sapphire-soft": "#EAEEFF",
    amethyst: "#8B5CF6",
    "amethyst-soft": "#F3EDFF",
    teal: "#0FB5BA",
    "teal-soft": "#E4F7F8",
    rose: "#E2557B",
    "rose-soft": "#FCEBF0",
  },
  verified: {
    emerald: "#0E9F6E",
    "emerald-soft": "#E6F6EF",
  },
  studio: {
    obsidian: "#070B16",
    "obsidian-soft": "#0E1424",
    "obsidian-line": "#1E2740",
  },
  ink: {
    primary: "#151B2E",
    muted: "#5D6478",
    inverse: "#FBF8F1",
  },
  line: "#E5DBC9",
  danger: "#D93B4B",
  warning: "#C77A16",
};

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors,
      borderRadius: designTokens.borderRadius,
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-plus-jakarta)", "var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(7, 15, 36, 0.04), 0 18px 44px -26px rgba(7, 15, 36, 0.26)",
        floating: "0 28px 80px -28px rgba(7, 15, 36, 0.48)",
        luxe: "0 1px 2px rgba(7, 15, 36, 0.04), 0 30px 78px -38px rgba(7, 15, 36, 0.34)",
        "luxe-lg": "0 40px 110px -46px rgba(7, 15, 36, 0.58)",
        "emerald-glow":
          "0 0 0 1px rgba(14, 159, 110, 0.22), 0 20px 56px -22px rgba(14, 159, 110, 0.55)",
        "sapphire-glow":
          "0 0 0 1px rgba(59, 91, 255, 0.2), 0 20px 56px -22px rgba(59, 91, 255, 0.5)",
        "gold-hairline": "inset 0 0 0 1px rgba(200, 164, 93, 0.38)",
        "jewel-inner": "inset 0 1px 0 rgba(255, 255, 255, 0.65)",
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
        // Graduation-cap hero art: a slow, single toss with a long resting tail.
        "cap-toss": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "8%": { transform: "translateY(-2px) rotate(-1deg)" },
          "20%": { transform: "translateY(-14px) rotate(-3deg)" },
          "34%": { transform: "translateY(-16px) rotate(1.5deg)" },
          "50%": { transform: "translateY(-4px) rotate(0.5deg)" },
          "60%": { transform: "translateY(0) rotate(0deg)" },
        },
        "cap-tassel": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "18%": { transform: "rotate(7deg)" },
          "38%": { transform: "rotate(-5deg)" },
          "58%": { transform: "rotate(3deg)" },
          "78%": { transform: "rotate(-1.5deg)" },
        },
        "aurora-drift": {
          "0%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "50%": { transform: "translate3d(24px, -18px, 0) scale(1.08)" },
          "100%": { transform: "translate3d(-16px, 12px, 0) scale(0.96)" },
        },
        // Engraved contour lines breathe rather than slide, so the eye reads
        // them as a static security print under the content.
        "topo-drift": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "50%": { transform: "translate3d(-14px, 9px, 0) scale(1.012)" },
        },
        "topo-drift-slow": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1.01)" },
          "50%": { transform: "translate3d(16px, -11px, 0) scale(1)" },
        },
        "reveal-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        sheen: {
          from: { transform: "translateX(-120%) skewX(-12deg)" },
          to: { transform: "translateX(220%) skewX(-12deg)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        "check-pop": {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "60%": { opacity: "1", transform: "scale(1.08)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "caret-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateY(10px) scale(0.99)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.75" },
        },
        // Slow hue travel across a gradient surface: the signature "living
        // silk" motion used on primary actions and jewel borders.
        "gradient-pan": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "jewel-float": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "50%": { transform: "translate3d(0, -14px, 0) scale(1.04)" },
        },
        "glow-breathe": {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0.7", transform: "scale(1.08)" },
        },
        "line-sweep": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
      },
      animation: {
        marquee: "marquee 52s linear infinite",
        "float-slow": "float-slow 7s ease-in-out infinite",
        "fade-up": "fade-up 0.6s ease-out both",
        "ring-pulse": "ring-pulse 3.2s ease-in-out infinite",
        "cap-toss": "cap-toss 8s cubic-bezier(0.45, 0, 0.55, 1) infinite",
        "cap-tassel": "cap-tassel 6.5s ease-in-out infinite",
        "aurora-drift": "aurora-drift 20s ease-in-out infinite alternate",
        "topo-drift": "topo-drift 46s ease-in-out infinite",
        "topo-drift-slow": "topo-drift-slow 68s ease-in-out infinite",
        "reveal-up": "reveal-up 0.65s cubic-bezier(0.16, 1, 0.3, 1) both",
        sheen: "sheen 0.9s cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 1.8s linear infinite",
        "check-pop": "check-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "caret-blink": "caret-blink 1.1s steps(2, start) infinite",
        "slide-in": "slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-soft": "pulse-soft 5s ease-in-out infinite",
        "gradient-pan": "gradient-pan 9s ease-in-out infinite",
        "jewel-float": "jewel-float 12s ease-in-out infinite",
        "glow-breathe": "glow-breathe 8s ease-in-out infinite",
        "line-sweep": "line-sweep 6s linear infinite",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      backgroundImage: {
        "hero-grid":
          "linear-gradient(to right, rgba(226, 232, 240, 0.65) 1px, transparent 1px), linear-gradient(to bottom, rgba(226, 232, 240, 0.65) 1px, transparent 1px)",
        "jewel-emerald": "linear-gradient(135deg, #0E9F6E 0%, #0FB5BA 55%, #3B5BFF 100%)",
        "jewel-gold": "linear-gradient(135deg, #E9CF96 0%, #C8A45D 52%, #A9853F 100%)",
        "jewel-ink": "linear-gradient(140deg, #070F24 0%, #0E1B3D 58%, #152A5E 100%)",
        "jewel-halo":
          "radial-gradient(60% 80% at 20% 10%, rgba(14,159,110,0.16), transparent 65%), radial-gradient(55% 70% at 80% 0%, rgba(59,91,255,0.14), transparent 68%), radial-gradient(45% 60% at 55% 100%, rgba(139,92,246,0.12), transparent 70%)",
      },
    },
  },
  plugins: [],
};

export default config;
