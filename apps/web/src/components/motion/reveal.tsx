"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger offset in milliseconds. Keep siblings within ~70ms of each other. */
  delay?: number;
}

/*
 * The root layout adds `.js` before first paint, which hides reveal content
 * until it is observed. If hydration never completes, an inline timeout drops
 * `.js` again so nothing stays invisible. Setting this flag tells that timeout
 * the app is alive, so scroll reveals keep working past the safety window.
 */
let revealReadyMarked = false;

function markRevealReady() {
  if (revealReadyMarked) return;
  revealReadyMarked = true;
  document.documentElement.setAttribute("data-reveal-ready", "");
}

/**
 * Fades and lifts its children into view once, when they first enter the
 * viewport. Content stays visible when JavaScript is off or the user prefers
 * reduced motion, so this is purely decorative.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    markRevealReady();

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Reveal when in view, or immediately if the browser restored a
          // scroll position past the element (it is already above us).
          const aboveViewport = entry.boundingClientRect.bottom <= 0;
          if (entry.isIntersecting || aboveViewport) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", visible && "is-visible", className)}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
