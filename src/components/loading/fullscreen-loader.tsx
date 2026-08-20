"use client";

/**
 * FullscreenLoader — blocking overlay loader with brand identity.
 *
 * Use for operations that block the entire screen (e.g., auth redirect,
 * critical data fetch before page can render, payment processing).
 *
 * Unlike PageLoader (which takes the full viewport naturally), this renders
 * as a fixed overlay on top of existing UI — useful for client-side blocking
 * states inside already-rendered pages.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { BrandLoader } from "./brand-loader";

interface FullscreenLoaderProps {
  label?: string;
  /** Backdrop opacity (0–100). Default: 80 */
  backdropOpacity?: number;
  className?: string;
}

export function FullscreenLoader({
  label,
  backdropOpacity = 80,
  className,
}: FullscreenLoaderProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background",
        className,
      )}
      style={{ opacity: backdropOpacity / 100 === 1 ? undefined : backdropOpacity / 100 }}
      aria-busy="true"
      aria-live="polite"
      aria-label={label ?? "Loading…"}
    >
      <BrandLoader size="lg" animate />
      {label && (
        <p
          className="animate-fade-in text-xs font-medium text-muted-foreground"
          style={{ animationDelay: "300ms", animationFillMode: "both" }}
        >
          {label}
        </p>
      )}
    </div>
  );
}
