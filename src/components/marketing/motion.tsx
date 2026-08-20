"use client";

import * as React from "react";
import { motion, type Variants, type HTMLMotionProps } from "motion/react";

/**
 * Shared motion utilities for the marketing site.
 *
 * Timings come from design-system/MASTER.md §7 and are not to be overridden
 * per component. v1 shipped 550-800ms reveals against a 250ms spec; v2 names
 * the scroll-reveal case explicitly and caps it at 400ms. Anything slower
 * reads as sluggish rather than considered.
 *
 * Reduced motion is handled globally in two places and needs both:
 * the CSS block in globals.css, and MotionProvider (which passes
 * `reducedMotion` through MotionConfig — CSS cannot reach Motion's inline
 * transforms). Nothing here re-implements it.
 *
 * Removed in v2: `Floating` (an infinite decorative loop, and the thing that
 * survived reduced-motion), `GradientMesh` and `GlowSpotlight` (blur is
 * retired as a depth mechanism — see MASTER.md §6).
 */

/** MASTER.md §7. Marketing scroll reveal. */
const REVEAL = 0.4;
/** 30-50ms per item, capped at six. */
const STAGGER = 0.04;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: REVEAL, ease: EASE_OUT } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: REVEAL, ease: EASE_OUT } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: { duration: REVEAL, ease: EASE_OUT } },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: STAGGER, delayChildren: 0.02 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: REVEAL, ease: EASE_OUT } },
};

/** Reveals its child once, when it scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  variants = fadeInUp,
  amount = 0.2,
  as: Component = motion.div,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  variants?: Variants;
  amount?: number;
  as?: typeof motion.div;
} & Omit<HTMLMotionProps<"div">, "variants" | "children">) {
  return (
    <Component
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={variants}
      transition={{ delay }}
      className={className}
      {...rest}
    >
      {children}
    </Component>
  );
}

/**
 * Staggers child reveals on scroll.
 *
 * MASTER.md §7 caps the stagger at six items — past that the last card lands
 * long after the reader has already looked at it. Longer lists should reveal
 * as one block: pass `stagger={false}`.
 */
export function StaggerReveal({
  children,
  className,
  amount = 0.2,
  stagger = true,
}: {
  children: React.ReactNode;
  className?: string;
  amount?: number;
  stagger?: boolean;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={stagger ? staggerContainer : fadeIn}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}
