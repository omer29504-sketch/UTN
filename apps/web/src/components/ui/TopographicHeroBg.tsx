import { cn } from "@/lib/utils";

type Tone = "navy" | "light";
type FadeTo = "navy" | "canvas" | "none";

const EMERALD_STROKE = "rgba(16, 185, 129, 0.14)";
const GOLD_STROKE = "rgba(197, 160, 89, 0.10)";

interface Peak {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rings: number;
  seed: number;
  tone: "emerald" | "gold";
}

/**
 * Hand-placed "peaks" so the contour field is identical on every render — the
 * engraving is part of the brand, not a random decoration.
 */
const PEAKS: Peak[] = [
  { cx: 180, cy: 130, rx: 250, ry: 170, rings: 9, seed: 0.4, tone: "emerald" },
  { cx: 1260, cy: 70, rx: 320, ry: 200, rings: 8, seed: 1.9, tone: "gold" },
  { cx: 1120, cy: 650, rx: 300, ry: 210, rings: 9, seed: 3.1, tone: "emerald" },
  { cx: 470, cy: 590, rx: 220, ry: 150, rings: 6, seed: 5.2, tone: "gold" },
  { cx: 760, cy: 300, rx: 190, ry: 125, rings: 5, seed: 2.4, tone: "emerald" },
];

/** Catmull-Rom → cubic bezier so each contour closes without a visible seam. */
function smoothClosedPath(points: Array<[number, number]>) {
  const count = points.length;
  const first = points[0]!;
  let d = `M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`;

  for (let i = 0; i < count; i += 1) {
    const p0 = points[(i - 1 + count) % count]!;
    const p1 = points[i]!;
    const p2 = points[(i + 1) % count]!;
    const p3 = points[(i + 2) % count]!;

    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }

  return `${d} Z`;
}

function buildContours(peak: Peak) {
  return Array.from({ length: peak.rings }, (_, index) => {
    const scale = (index + 1) / peak.rings;
    const points: Array<[number, number]> = [];
    const steps = 28;

    for (let step = 0; step < steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2;
      // Deterministic wobble keeps the rings organic without any randomness.
      const wobble =
        1 +
        0.075 * Math.sin(3 * angle + peak.seed) +
        0.045 * Math.cos(5 * angle + peak.seed * 1.7) +
        0.02 * Math.sin(7 * angle + peak.seed * 2.3);

      points.push([
        peak.cx + Math.cos(angle) * peak.rx * scale * wobble,
        peak.cy + Math.sin(angle) * peak.ry * scale * wobble,
      ]);
    }

    return smoothClosedPath(points);
  });
}

const EMERALD_CONTOURS = PEAKS.filter((peak) => peak.tone === "emerald").flatMap(buildContours);
const GOLD_CONTOURS = PEAKS.filter((peak) => peak.tone === "gold").flatMap(buildContours);

const VIGNETTE: Record<Tone, string> = {
  navy: "radial-gradient(125% 105% at 50% 30%, rgba(10,17,40,0) 0%, rgba(10,17,40,0.34) 56%, rgba(10,17,40,0.94) 100%)",
  light:
    "radial-gradient(125% 105% at 50% 30%, rgba(248,250,252,0) 0%, rgba(248,250,252,0.4) 58%, rgba(248,250,252,0.96) 100%)",
};

const FADE: Record<Exclude<FadeTo, "none">, string> = {
  navy: "from-transparent to-brand-navy",
  canvas: "from-transparent to-surface-canvas",
};

/**
 * Engraved topographic backdrop evoking private banking and anti-counterfeit
 * certificate stock. Pure SVG paths + two CSS transforms, no canvas or JS.
 *
 * Place inside a `relative` container. The component paints its own tone
 * surface, the contour field, a radial vignette, and an optional bottom fade.
 */
export function TopographicHeroBg({
  className,
  tone = "navy",
  fadeTo = "navy",
}: {
  className?: string;
  tone?: Tone;
  fadeTo?: FadeTo;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        tone === "navy" ? "bg-brand-navy" : "bg-surface-canvas",
        className,
      )}
    >
      <div className="bg-luxury-grain absolute inset-0 opacity-80" />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 720"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <g className="animate-topo-drift" stroke={EMERALD_STROKE} strokeWidth="1">
          {EMERALD_CONTOURS.map((d, index) => (
            <path key={`emerald-${index}`} d={d} />
          ))}
        </g>
        <g className="animate-topo-drift-slow" stroke={GOLD_STROKE} strokeWidth="1">
          {GOLD_CONTOURS.map((d, index) => (
            <path key={`gold-${index}`} d={d} />
          ))}
        </g>
      </svg>

      <div className="absolute inset-0" style={{ background: VIGNETTE[tone] }} />

      {fadeTo === "none" ? null : (
        <div className={cn("absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b", FADE[fadeTo])} />
      )}
    </div>
  );
}
