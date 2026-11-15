import { Building2 } from "lucide-react";
import { MARQUEE_PLACEHOLDER_COUNT } from "@utn/shared";

interface Logo {
  id: string;
  name: string;
  logoUrl: string | null;
}

export function LogoMarquee({ logos }: { logos: Logo[] }) {
  const items: Logo[] =
    logos.length > 0
      ? logos
      : Array.from({ length: MARQUEE_PLACEHOLDER_COUNT }, (_, i) => ({
          id: `placeholder-${i}`,
          name: "Early partner",
          logoUrl: null,
        }));

  // Duplicate for a seamless loop.
  const track = [...items, ...items];

  return (
    <div className="relative overflow-hidden py-6 mask-fade-x">
      <div className="flex w-max animate-marquee gap-12">
        {track.map((logo, index) => (
          <div
            key={`${logo.id}-${index}`}
            className="flex h-14 w-36 shrink-0 items-center justify-center rounded-xl border border-line bg-white px-4 shadow-sm"
          >
            {logo.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo.logoUrl}
                alt={logo.name}
                className="max-h-8 max-w-full object-contain"
                loading="lazy"
              />
            ) : (
              <div className="flex items-center gap-2 text-ink-muted">
                <Building2 className="size-5" aria-hidden />
                <span className="text-xs font-semibold">{logo.name}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
