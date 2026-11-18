import { cn } from "@/lib/utils";

/**
 * Decorative graduation cap used as the platform's signature motion moment.
 * It tosses once every eight seconds and the tassel swings on its own rhythm.
 * Hidden from assistive technology; all animation stops under reduced motion.
 */
export function GradCap({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-block", className)} aria-hidden>
      <span className="absolute inset-[14%] animate-pulse-soft rounded-full bg-accent-emerald/40 blur-2xl motion-reduce:animate-none" />
      <svg
        viewBox="0 0 120 120"
        className="relative h-full w-full animate-cap-toss drop-shadow-[0_20px_32px_rgba(9,13,22,0.4)] motion-reduce:animate-none"
        role="presentation"
        focusable="false"
      >
        {/* Mortarboard */}
        <path d="M60 20 110 44 60 68 10 44Z" fill="#FFFCF7" />
        <path d="M60 20 110 44 60 68Z" fill="#E6F6EF" />
        {/* Cap base */}
        <path d="M30 55v13c0 9.5 13.4 17 30 17s30-7.5 30-17V55L60 68Z" fill="#C9EDE0" />
        <path d="M60 68 90 55v13c0 9.5-13.4 17-30 17Z" fill="#9FE3CE" />
        {/* Center button */}
        <circle cx="60" cy="44" r="3.6" fill="#0E9F6E" />
        {/* Tassel */}
        <g
          className="animate-cap-tassel motion-reduce:animate-none"
          style={{ transformBox: "fill-box", transformOrigin: "top center" }}
        >
          <path
            d="M60 45c0 8 12 12 22 18"
            fill="none"
            stroke="#0E9F6E"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <path d="M82 63v13" stroke="#0E9F6E" strokeLinecap="round" strokeWidth="3" />
          <path d="M77 76h10l-2.5 12h-5Z" fill="#C8A45D" />
        </g>
      </svg>
    </span>
  );
}
