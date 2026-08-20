"use client";

/**
 * PageLoader — full-viewport branded loading screen.
 *
 * Used in:
 *   - Root loading.tsx (replaces bare Loader2 spinner)
 *   - Any page that needs a fullscreen loading state
 *
 * Design: centered BrandLoader on the app background, no extra chrome.
 * The label fades in slightly after the icon to give a sense of sequence.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { BrandLoader } from "./brand-loader";

interface PageLoaderProps {
  /** Optional message shown below the icon. Defaults to nothing (icon only). */
  label?: string;
  className?: string;
}

export function PageLoader({ label, className }: PageLoaderProps) {
  return (
    <div
      className={cn(
        "flex min-h-screen flex-col items-center justify-center gap-5 bg-background",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
    >
      <BrandLoader size="lg" animate />
      {label && (
        <p
          className="animate-fade-in text-xs font-medium text-muted-foreground"
          style={{ animationDelay: "400ms", animationFillMode: "both" }}
        >
          {label}
        </p>
      )}
    </div>
  );
}
