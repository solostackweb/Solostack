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

/** Deep action blue used for hover, pressed, and high-contrast blue text. */
export const BRAND_PRIMARY_DEEP = "#173EA5";

/** Periwinkle support colour. It is atmosphere, never a primary action. */
export const BRAND_ACCENT = "#7186E8";

/** Light blue for text on dark brand surfaces (OG images). */
export const BRAND_ON_DARK = "#6B9CFF";

/** Near-black canvas. Must equal `background_color` in the web manifest. */
export const BRAND_CANVAS_DARK = "#081020";

/** Default brand colour for documents when a user hasn't chosen one. */
export const DEFAULT_DOCUMENT_BRAND = "#111936";

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
