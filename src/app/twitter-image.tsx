import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";
import { BRAND_PRIMARY, BRAND_PRIMARY_DEEP, BRAND_ON_DARK } from "@/config/brand-colors";

/**
 * Site-wide Open Graph image, generated at build time via next/og.
 * Brand: blue-only, dark canvas, the two-bar Stackivo mark.
 */
export const runtime = "edge";
export const alt = "Stackivo — your client work, finally in one place";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#0b1120",
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 70% 0%, rgba(37,99,235,0.35), transparent 70%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* Mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: "10px",
              width: "84px",
              height: "84px",
              borderRadius: "20px",
              background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_PRIMARY_DEEP})`,
            }}
          >
            <div
              style={{
                width: "44px",
                height: "12px",
                borderRadius: "6px",
                backgroundColor: "#ffffff",
                marginRight: "8px",
              }}
            />
            <div
              style={{
                width: "44px",
                height: "12px",
                borderRadius: "6px",
                backgroundColor: "rgba(255,255,255,0.92)",
                marginLeft: "8px",
              }}
            />
          </div>
          <div style={{ display: "flex", fontSize: "44px", fontWeight: 700, letterSpacing: "-1px" }}>
            Stackivo
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "56px",
            fontSize: "76px",
            fontWeight: 700,
            letterSpacing: "-2.5px",
            lineHeight: 1.1,
            maxWidth: "950px",
          }}
        >
          Your client work, finally in one place.
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "32px",
            fontSize: "30px",
            color: "rgba(226,232,240,0.75)",
            maxWidth: "900px",
            lineHeight: 1.45,
          }}
        >
          Contracts, invoices, projects, time &amp; payments — one GST-ready
          workspace for Indian freelancers and studios.
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "56px",
            fontSize: "24px",
            color: BRAND_ON_DARK,
            fontWeight: 600,
          }}
        >
          {new URL(siteConfig.url).host} · Free for your first 5 clients
        </div>
      </div>
    ),
    size,
  );
}
