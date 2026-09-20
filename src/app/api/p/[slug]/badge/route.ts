import { type NextRequest, NextResponse } from "next/server";
import {
  getPublicProfileBySlug,
  getPublicProfileStats,
} from "@/features/profile/public-profile-server";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Embeddable verified-review badge (SVG).
 *
 * GET /api/p/:slug/badge → 320×96 SVG with average rating, review count,
 * and "Verified by Stackivo". Public, cacheable, no auth. Only renders when
 * the profile is enabled and reviews are visible; otherwise 404 so sites
 * don't embed a dead badge.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const profile = await getPublicProfileBySlug(slug);

  if (!profile || profile.public_show_reviews === false) {
    return new NextResponse("Not found", { status: 404 });
  }

  const stats = await getPublicProfileStats(profile.id);
  const count = stats?.verified_reviews ?? 0;
  if (count === 0) {
    return new NextResponse("No reviews yet", { status: 404 });
  }

  const avg = stats?.average_rating ?? 0;
  const avgText = Number(avg).toFixed(1);
  const name =
    profile.display_name?.trim() ||
    profile.full_name?.trim() ||
    "Freelancer";
  const label = `${avgText} · ${count} verified review${count === 1 ? "" : "s"}`;

  const stars = [1, 2, 3, 4, 5]
    .map((i) => {
      const fill = i <= Math.round(Number(avg)) ? "#F59E0B" : "#E5E7EB";
      const x = 16 + (i - 1) * 22;
      return `<path d="M${x} 30 l3.1 6.3 6.9 1 -5 4.9 1.2 6.9 -6.2 -3.3 -6.2 3.3 1.2 -6.9 -5 -4.9 6.9 -1z" fill="${fill}"/>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="96" role="img" aria-label="${escapeXml(label)}">
  <rect width="320" height="96" rx="12" fill="#ffffff" stroke="#e5e7eb"/>
  <text x="16" y="22" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="#111827">${escapeXml(name)}</text>
  ${stars}
  <text x="16" y="72" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#374151">${escapeXml(label)}</text>
  <text x="16" y="86" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#6b7280">Verified by Stackivo</text>
</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
