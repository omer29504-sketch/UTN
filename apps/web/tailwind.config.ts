import type { Config } from "tailwindcss";
import { designTokens } from "@utn/shared/design-tokens";

/**
 * Web-only Quiet Luxury palette.
 *
 * The canonical palette in `@utn/shared/design-tokens` still drives the mobile
 * app, so the web surface gets its own explicit colour map here. Do not spread
 * the shared tokens into `colors` — that would silently re-colour the indigo
 * accents the native client depends on.
 */
const colors = {
  brand: {
    navy: "#0A1128",
    "navy-soft": "#111C38",
    "navy-line": "#1E2A4A",
  },
  surface: {
    canvas: "#F8FAFC",
    card: "#FFFFFF",
    muted: "#F1F5F9",
  },
  accent: {
    emerald: "#10B981",
    "emerald-hover": "#059669",
    "emerald-soft": "#ECFDF5",
    gold: "#C5A059",
    "gold-hover": "#A8873F",
    "gold-soft": "#F7F1E4",
  },
  verified: {
    emerald: "#10B981",
    "emerald-soft": "#ECFDF5",
  },
  studio: {
    obsidian: "#080D1C",
    "obsidian-soft": "#111C38",
    "obsidian-line": "#22304F",
  },
  ink: {
    primary: "#1E293B",
    muted: "#64748B",
    inverse: "#F8FAFC",
  },
  line: "#E2E8F0",
  danger: "#DC2626",
  warning: "#D97706",
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
        card: "0 1px 2px rgba(10, 17, 40, 0.04), 0 16px 40px -24px rgba(10, 17, 40, 0.24)",
        floating: "0 24px 70px -24px rgba(10, 17, 40, 0.45)",
        luxe: "0 1px 2px rgba(10, 17, 40, 0.04), 0 28px 70px -36px rgba(10, 17, 40, 0.32)",
        "luxe-lg": "0 36px 100px -44px rgba(10, 17, 40, 0.55)",
        "emerald-glow":
          "0 0 0 1px rgba(16, 185, 129, 0.2), 0 18px 50px -20px rgba(16, 185, 129, 0.5)",
        "gold-hairline": "inset 0 0 0 1px rgba(197, 160, 89, 0.35)",
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
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
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
