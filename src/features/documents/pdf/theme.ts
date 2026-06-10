import "server-only";

import { Font } from "@react-pdf/renderer";

// Disable react-pdf's default hyphenation. It breaks words mid-syllable
// ("Website" → "Web-site", "invoice" → "in-voice") which reads as a typo on
// business documents. Registered here because every template imports theme.
Font.registerHyphenationCallback((word) => [word]);

/**
 * Shared PDF design tokens.
 *
 * One source of truth for typography, colour, spacing, and radii across
 * every generated document (invoice, receipt, contract, welcome doc,
 * future exports). Templates DO NOT define their own colours or font
 * sizes — they reference these tokens.
 *
 * Keep these in rough alignment with the app's Tailwind palette so the
 * PDF feels like a natural extension of the dashboard rather than a
 * disconnected output.
 *
 * Sizes are points (1/72in) since React-PDF is a print medium.
 */

// --- Colour --------------------------------------------------------------
// Neutral slate ramp + semantic tones. The brand accent is resolved at
// runtime from the freelancer's `user_profiles.brand_color` (see
// `./brand.ts`) and overlays this palette.

export const pdfColors = {
  // Neutrals
  white: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC", // slate-50
  surfaceSubtle: "#F1F5F9", // slate-100

  // Text
  foreground: "#0F172A", // slate-900
  text: "#1E293B", // slate-800
  mutedForeground: "#64748B", // slate-500
  faint: "#94A3B8", // slate-400

  // Lines
  border: "#E2E8F0", // slate-200
  borderStrong: "#CBD5E1", // slate-300

  // Brand defaults — only used when the freelancer hasn't set a brand
  // colour. Real templates always go through `resolveBrand(...)`.
  primary: "#2563EB", // blue-600
  primarySoft: "#EFF6FF", // blue-50

  // Semantic
  success: "#16A34A", // green-600
  successSoft: "#DCFCE7", // green-100
  warning: "#CA8A04", // amber-600
  warningSoft: "#FEF3C7", // amber-100
  danger: "#DC2626", // red-600
  dangerSoft: "#FEE2E2", // red-100
} as const;

// --- Spacing scale (4-pt grid) ------------------------------------------
// Use named tokens, not raw numbers. Templates should never write
// `padding: 12` inline — use `pdfSpacing.md`.

export const pdfSpacing = {
  /** 4pt */
  xs: 4,
  /** 8pt */
  sm: 8,
  /** 12pt */
  md: 12,
  /** 16pt */
  lg: 16,
  /** 20pt */
  xl: 20,
  /** 24pt */
  "2xl": 24,
  /** 32pt */
  "3xl": 32,
  /** 40pt */
  "4xl": 40,

  // Layout-level constants
  pagePadding: 40,
  sectionGap: 22,
  rowGap: 6,
} as const;

// --- Type scale ---------------------------------------------------------
// Sizes are deliberately tight; printed type at 11-12pt is the
// equivalent of a body-text 16px on screen. Don't go larger for body
// or the document starts to feel like a poster.

export const pdfSizes = {
  /** Fine-print, footer numerals. */
  xs: 7.5,
  /** Eyebrow labels, meta. */
  eyebrow: 8.5,
  /** Compact body / table cells. */
  sm: 9.5,
  /** Body text. */
  base: 10.5,
  /** Subheadings. */
  md: 12,
  /** Section titles. */
  lg: 14,
  /** Document subtitle. */
  xl: 18,
  /** Document title. */
  "2xl": 24,
  /** Cover headline. */
  "3xl": 34,
} as const;

// --- Font families ------------------------------------------------------
// We use the React-PDF built-ins. Helvetica is bundled and renders
// crisply at print resolutions. Switching to a custom OTF would require
// a `Font.register(...)` call elsewhere in the pipeline and is left as
// a future upgrade.

export const pdfFonts = {
  base: "Helvetica",
  semibold: "Helvetica-Bold", // Helvetica-Bold is heavier than ideal "semibold" but the
  bold: "Helvetica-Bold",
  mono: "Courier",
  italic: "Helvetica-Oblique",
} as const;

// --- Radii --------------------------------------------------------------

export const pdfRadii = {
  none: 0,
  sm: 3,
  md: 6,
  lg: 9,
  pill: 999,
} as const;

// --- Letter-spacing -----------------------------------------------------
// For uppercase eyebrow labels — slight tracking restores legibility
// at small sizes.

export const pdfTracking = {
  tight: -0.2,
  normal: 0,
  wide: 0.5,
  wider: 0.8,
  widest: 1.4,
} as const;

// --- Line height --------------------------------------------------------

export const pdfLineHeights = {
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.65,
} as const;

// --- A4 dimensions (pt) -------------------------------------------------

export const pdfPage = {
  size: "A4" as const,
  width: 595.28,
  height: 841.89,
  contentWidth: 595.28 - 40 * 2, // matches pagePadding
} as const;
