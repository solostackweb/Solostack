import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/**
 * Robots policy.
 *
 * Search engines and AI crawlers are explicitly welcome on the public
 * marketing surface — being citable by ChatGPT / Claude / Perplexity is
 * distribution. Private app surfaces (dashboard, portal, short links,
 * auth callbacks) are off-limits for everyone.
 */
const PRIVATE_PATHS = [
  "/dashboard",
  "/dashboard/",
  "/onboarding",
  "/onboarding/",
  "/portal",
  "/portal/",
  "/portal-access",
  "/admin",
  "/admin/",
  "/api/",
  "/auth/",
  "/i/",
  "/c/",
  "/p/",
  "/lead/",
  "/w/",
  "/forgot-password",
  "/reset-password",
];

/** AI / LLM crawlers we explicitly allow on public pages. */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      ...AI_CRAWLERS.map((agent) => ({
        userAgent: agent,
        allow: "/",
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
