"use client";

import * as React from "react";
import { motion, type Variants, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Shared Framer Motion utilities for the marketing site.
 *
 * Keeps animation timing, easing and choreography consistent across every
 * section. Components should compose `Reveal`, `StaggerReveal` and
 * `StaggerItem` rather than re-implementing variants locally.
 */

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE_OUT },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8, ease: EASE_OUT } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.7, ease: EASE_OUT },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE_OUT },
  },
};

/** Reveals child once it scrolls into view. */
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

/** Container that staggers child reveals on scroll. */
export function StaggerReveal({
  children,
  className,
  amount = 0.2,
}: {
  children: React.ReactNode;
  className?: string;
  amount?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={staggerContainer}
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

/** Slow floating motion for hero / mockup elements. */
export function Floating({
  children,
  className,
  amplitude = 8,
  duration = 7,
}: {
  children: React.ReactNode;
  className?: string;
  amplitude?: number;
  duration?: number;
}) {
  return (
    <motion.div
      className={className}
      animate={{ y: [-amplitude, amplitude, -amplitude] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated multi-layer gradient mesh. Sits as a -z-10 background fill.
 * Pure CSS animation so it works in SSR.
 */
export function GradientMesh({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      <div className="absolute -left-[15%] top-[-20%] h-[60%] w-[60%] rounded-full bg-primary/15 blur-[120px]" />
      <div className="absolute right-[-10%] top-[10%] h-[55%] w-[55%] rounded-full bg-primary/10 blur-[110px]" />
      <div className="absolute bottom-[-20%] left-[20%] h-[50%] w-[50%] rounded-full bg-primary/[0.08] blur-[100px]" />
    </div>
  );
}

/** Soft directional glow behind a card / mockup. */
export function GlowSpotlight({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute -inset-x-8 -top-10 -z-10 h-[120%] rounded-[3rem] bg-gradient-to-b from-primary/15 via-primary/[0.08] to-transparent blur-3xl",
        className,
      )}
    />
  );
}
