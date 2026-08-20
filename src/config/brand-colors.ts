/**
 * Literal brand colours, for the places CSS tokens cannot reach.
 *
 * Everything that renders inside the app should use semantic Tailwind tokens
 * (`bg-primary`, `text-foreground`) — see `design-system/MASTER.md`. These
 * constants exist only for contexts where a CSS custom property is genuinely
 * unavailable:
 *
 *   - `ImageResponse` (opengraph-image, twitter-image, PWA icons) renders at
 *     the edge with inline styles and no stylesheet.
 *   - SVG gradient stops inside string templates.
 *   - The PWA splash, which must match `background_color` in the manifest
 *     byte-for-byte or the OS shows a flash of the wrong colour.
 *   - Defaults for user-configurable brand colours, which are data rather
 *     than styling.
 *   - Config handed to third-party SDKs (e.g. the Razorpay checkout theme).
 *
 * The point of this file is that the value appears once. Changing the brand
 * should be one edit here, not fourteen across the codebase.
 */

/** Stackivo blue. Mirrors `--primary` (221 83% 53%) in globals.css. */
export const BRAND_PRIMARY = "#2563EB";

/** Deeper blue used as the end stop of brand gradients. */
export const BRAND_PRIMARY_DEEP = "#1D4ED8";

/** Indigo used as the second stop of the logo gradient. */
export const BRAND_ACCENT = "#4F46E5";

/** Light blue for text on dark brand surfaces (OG images). */
export const BRAND_ON_DARK = "#60A5FA";

/** Near-black canvas. Must equal `background_color` in the web manifest. */
export const BRAND_CANVAS_DARK = "#0a1020";

/** Default brand colour for documents when a user hasn't chosen one. */
export const DEFAULT_DOCUMENT_BRAND = "#0F172A";

/**
 * WhatsApp's own brand colours. Third-party marks must not be recoloured, so
 * these stay literal.
 *
 * Note: Tailwind arbitrary values (`bg-[#25D366]`) cannot read a runtime
 * constant — the scanner needs the literal in the class string — so the share
 * buttons keep their inline values. These constants are for inline styles and
 * SVG only.
 */
export const WHATSAPP_GREEN = "#25D366";
export const WHATSAPP_GREEN_DARK = "#128C7E";
