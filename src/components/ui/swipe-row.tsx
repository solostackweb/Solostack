"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Swipe-to-reveal row actions (mobile).
 *
 * Wrap a list row; on a left-swipe (touch) the row slides to reveal up to a few
 * action buttons on the right, like native mail/list apps. On non-touch / wide
 * screens it renders the row as-is (actions are reached via the usual "…" menu),
 * so desktop is unaffected. Tapping the row content while open snaps it closed.
 */
export interface SwipeAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Red destructive styling. */
  destructive?: boolean;
  /** Tailwind bg class for the action tile (defaults by tone). */
  className?: string;
}

export function SwipeRow({
  children,
  actions,
  className,
}: {
  children: React.ReactNode;
  actions: SwipeAction[];
  className?: string;
}) {
  const [offset, setOffset] = React.useState(0);
  const startX = React.useRef<number | null>(null);
  const startOffset = React.useRef(0);
  const dragging = React.useRef(false);
  const ACTION_W = 76;
  const max = actions.length * ACTION_W;

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startOffset.current = offset;
    dragging.current = true;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const next = Math.min(0, Math.max(-max, startOffset.current + dx));
    setOffset(next);
  };
  const onTouchEnd = () => {
    dragging.current = false;
    // Snap open if dragged past ~40% of the action strip, else closed.
    setOffset((o) => (o < -max * 0.4 ? -max : 0));
  };
  const close = () => setOffset(0);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Action strip behind the row */}
      <div className="absolute inset-y-0 right-0 flex">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                a.onClick();
                close();
              }}
              style={{ width: ACTION_W }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-micro font-medium text-white",
                a.className ??
                  (a.destructive ? "bg-destructive" : "bg-primary"),
              )}
            >
              <Icon className="h-4 w-4" />
              {a.label}
            </button>
          );
        })}
      </div>
      {/* Foreground row — slides over the action strip */}
      <div
        className="relative bg-background transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClickCapture={(e) => {
          // If open, first tap just closes (don't trigger the row click).
          if (offset !== 0) {
            e.preventDefault();
            e.stopPropagation();
            close();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
