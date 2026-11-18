import { cn } from "@/lib/utils";
import { TopographicField } from "./TopographicField";

type Tone = "navy" | "light";
type FadeTo = "navy" | "canvas" | "none";
type Intensity = "hero" | "ambient";

const VIGNETTE: Record<Tone, string> = {
  navy: "radial-gradient(125% 105% at 50% 26%, rgba(4,16,12,0) 0%, rgba(4,16,12,0.3) 48%, rgba(4,16,12,0.96) 100%)",
  light:
    "radial-gradient(125% 105% at 50% 30%, rgba(242,236,223,0) 0%, rgba(242,236,223,0.4) 58%, rgba(242,236,223,0.96) 100%)",
};

const FADE: Record<Exclude<FadeTo, "none">, string> = {
  navy: "from-transparent to-brand-navy",
  canvas: "from-transparent to-surface-canvas",
};

/**
 * Hand-drawn silk filaments. Each entry is a single stroked S-curve, so the
 * aurora keeps a visible fibre structure instead of reading as pure haze.
 * Coordinates live in the same 1440×720 space as the contour field.
 *
 * The first five are the broad ribbons' fibres; the last three are the fine
 * champagne and pearl threads that give the wave its "silk" character.
 */
const THREADS = [
  {
    d: "M -140 548 C 180 412, 360 664, 706 500 S 1186 296, 1580 402",
    stroke: "rgba(52, 211, 153, 0.6)",
    width: 1.4,
  },
  {
    d: "M -140 300 C 244 196, 428 404, 786 300 S 1224 128, 1580 224",
    stroke: "rgba(143, 163, 255, 0.55)",
    width: 1.1,
  },
  {
    d: "M -140 682 C 322 598, 526 744, 928 578 S 1322 498, 1580 560",
    stroke: "rgba(45, 212, 191, 0.45)",
    width: 1,
  },
  {
    d: "M -140 428 C 300 376, 520 524, 866 430 S 1284 336, 1580 380",
    stroke: "rgba(233, 207, 150, 0.34)",
    width: 0.9,
  },
  {
    d: "M -140 214 C 268 132, 512 300, 842 214 S 1268 84, 1580 152",
    stroke: "rgba(167, 139, 250, 0.38)",
    width: 0.8,
  },
  {
    d: "M -140 470 C 220 440, 470 566, 780 476 S 1200 388, 1580 448",
    stroke: "rgba(242, 220, 171, 0.2)",
    width: 0.7,
  },
  {
    d: "M -140 366 C 300 318, 560 462, 900 366 S 1300 270, 1580 322",
    stroke: "rgba(237, 230, 214, 0.18)",
    width: 0.6,
  },
  {
    d: "M -140 616 C 280 566, 540 690, 880 610 S 1290 540, 1580 596",
    stroke: "rgba(16, 185, 129, 0.24)",
    width: 0.6,
  },
] as const;

/**
 * Aurora / Midnight Emerald silk ribbons.
 *
 * A slow light field for dark surfaces: seven heavily blurred gradient
 * ribbons drifting on an emerald-ink sky, a conic sheen turning beneath them,
 * fine silk filaments above, then the engraved contour field, security grain,
 * a pearl horizon, and a deep vignette.
 *
 * Everything is CSS and inline SVG. There is no image request, no canvas, no
 * client JavaScript, and the global reduced-motion rule freezes the drift.
 *
 * Place inside a `relative` container. The component paints its own tone
 * surface and fills the parent absolutely.
 */
export function AuroraRibbons({
  className,
  tone = "navy",
  fadeTo = "navy",
  withTopography = false,
  intensity = "hero",
}: {
  className?: string;
  tone?: Tone;
  fadeTo?: FadeTo;
  /** Keep the anti-counterfeit contour print underneath the ribbons. */
  withTopography?: boolean;
  /** `ambient` softens the ribbons for in-app banners. */
  intensity?: Intensity;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        tone === "navy" ? "bg-brand-navy" : "bg-surface-paper",
        className,
      )}
    >
      {withTopography ? <TopographicField className="opacity-60" /> : null}

      <div
        className={cn(
          "aurora-field absolute inset-0",
          intensity === "ambient" && "aurora-field--ambient",
          tone === "light" && "aurora-field--light",
        )}
      >
        <span className="aurora-sheen" />

        <span className="aurora-ribbon aurora-ribbon--emerald aurora-ribbon--a" />
        <span className="aurora-ribbon aurora-ribbon--indigo aurora-ribbon--b" />
        <span className="aurora-ribbon aurora-ribbon--cyan aurora-ribbon--c" />
        <span className="aurora-ribbon aurora-ribbon--jade aurora-ribbon--f" />
        <span className="aurora-ribbon aurora-ribbon--amethyst aurora-ribbon--e" />
        <span className="aurora-ribbon aurora-ribbon--gold aurora-ribbon--d" />
        <span className="aurora-ribbon aurora-ribbon--pearl aurora-ribbon--g" />

        <span className="aurora-horizon" />
      </div>

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 720"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <g className="aurora-threads">
          {THREADS.map((thread) => (
            <path
              key={thread.d}
              d={thread.d}
              stroke={thread.stroke}
              strokeWidth={thread.width}
              strokeLinecap="round"
            />
          ))}
        </g>
      </svg>

      <div className="bg-luxury-grain absolute inset-0 opacity-70" />

      <div className="absolute inset-0" style={{ background: VIGNETTE[tone] }} />

      {fadeTo === "none" ? null : (
        <div className={cn("absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b", FADE[fadeTo])} />
      )}
    </div>
  );
}
