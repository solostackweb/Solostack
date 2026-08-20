import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { createElement as h } from "react";
import { BRAND_PRIMARY, BRAND_ACCENT } from "@/config/brand-colors";

export const runtime = "edge";

/**
 * Serves the Stackivo brand mark as a rasterised PNG at any requested size.
 *
 * Used by:
 *   - manifest.webmanifest  → /api/pwa-icon/192  and  /api/pwa-icon/512
 *   - <link rel="apple-touch-icon">  → /api/pwa-icon/180
 *   - Favicon fallback  → /api/pwa-icon/32
 *
 * ?maskable=1  adds a 10 % safe-zone inset so the icon looks correct when
 * adaptive / maskable icon masking is applied on Android.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ size: string }> },
) {
  const { size: sizeParam } = await context.params;
  const size = Math.min(1024, Math.max(16, parseInt(sizeParam, 10) || 512));
  const maskable = req.nextUrl.searchParams.has("maskable");

  // For maskable icons the safe-zone spec recommends ≥ 10 % on each side.
  const scale = maskable ? 0.78 : 1;
  const inner = Math.round(size * scale);

  // Icon uses the same SVG geometry as StackivoMark (viewBox 0 0 512 512).

  const tree = h(
    "div",
    {
      style: {
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg, ${BRAND_PRIMARY} 0%, ${BRAND_ACCENT} 100%)`,
        borderRadius: Math.round(size * 0.22),
      },
    },
    h(
      "svg",
      {
        width: inner,
        height: inner,
        viewBox: "0 0 512 512",
        xmlns: "http://www.w3.org/2000/svg",
        style: { display: "block" },
      },
      h("rect", {
        x: 96,
        y: 148,
        width: 280,
        height: 76,
        rx: 38,
        fill: "#FFFFFF",
      }),
      h("rect", {
        x: 136,
        y: 288,
        width: 280,
        height: 76,
        rx: 38,
        fill: "rgba(255,255,255,0.92)",
      }),
    ),
  );

  return new ImageResponse(tree, { width: size, height: size });
}
