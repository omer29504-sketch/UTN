import { AuroraRibbons } from "./AuroraRibbons";

type Tone = "navy" | "light";
type FadeTo = "navy" | "canvas" | "none";

/**
 * Brand background for dark hero banners.
 *
 * Historically this was the engraved contour print alone. It now composes the
 * contour field underneath the aurora silk ribbons, so every existing call
 * site gains the Northern Lights treatment without a per-page change.
 *
 * Place inside a `relative` container. The component paints its own tone
 * surface and fills the parent absolutely.
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
    <AuroraRibbons
      className={className}
      tone={tone}
      fadeTo={fadeTo}
      withTopography
      intensity="ambient"
    />
  );
}
