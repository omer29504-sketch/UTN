"use client";

import { useCallback, useRef, type HTMLAttributes, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** Frosted emerald glass (default) or the darker hero variant. */
  tone?: "light" | "dark";
  /** Add a gentle lift on hover. Off by default so calm surfaces stay calm. */
  interactive?: boolean;
}

/**
 * Frosted luxury card with a pointer-tracked emerald/gold spotlight.
 *
 * Coordinates are written straight to CSS custom properties on the node — no
 * React state, so moving the pointer never re-renders the subtree.
 */
export function SpotlightGlassCard({
  tone = "light",
  interactive = false,
  className,
  children,
  onPointerMove,
  onPointerLeave,
  ...props
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const node = ref.current;
      if (node) {
        const rect = node.getBoundingClientRect();
        node.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
        node.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
      }
      onPointerMove?.(event);
    },
    [onPointerMove],
  );

  const handlePointerLeave = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const node = ref.current;
      if (node) {
        node.style.setProperty("--mouse-x", "50%");
        node.style.setProperty("--mouse-y", "50%");
      }
      onPointerLeave?.(event);
    },
    [onPointerLeave],
  );

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={cn(
        "spotlight-card",
        tone === "dark" && "spotlight-card-dark",
        interactive && "spotlight-lift",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
