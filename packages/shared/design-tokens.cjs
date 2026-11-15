/**
 * Executive Slate & Alabaster design tokens.
 *
 * Kept as CommonJS so both Tailwind configs (web + NativeWind) can consume the
 * exact same palette without a build step. The canonical values live here only.
 */
const palette = {
  brand: {
    navy: "#0F172A",
    "navy-soft": "#1E293B",
  },
  surface: {
    canvas: "#F8FAFC",
    card: "#FFFFFF",
    muted: "#F1F5F9",
  },
  accent: {
    indigo: "#4F46E5",
    "indigo-hover": "#4338CA",
    "indigo-soft": "#EEF2FF",
  },
  verified: {
    emerald: "#10B981",
    "emerald-soft": "#ECFDF5",
  },
  studio: {
    obsidian: "#090D16",
    "obsidian-soft": "#111827",
    "obsidian-line": "#1F2937",
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

const radius = {
  card: "1rem", // rounded-2xl equivalent
};

module.exports = {
  palette,
  radius,
  /**
   * Ready-to-spread Tailwind `theme.extend` fragment for colors.
   * Font families are platform-specific and intentionally defined per app.
   */
  designTokens: {
    colors: palette,
    borderRadius: {
      card: radius.card,
    },
  },
};
