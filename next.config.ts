import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Production response headers.
 *
 * Defense-in-depth against MIME-sniffing, clickjacking, sensor abuse,
 * downgrade attacks, and untrusted referrer leakage. HSTS is set so
 * browsers refuse to talk HTTP to this origin once they've seen the
 * header (Vercel terminates TLS, so this is safe in all environments).
 *
 * CSP ships in Report-Only mode (see `cspReportOnly`) so it never breaks
 * the app while we confirm the allowlist; flip the header key to enforce.
 */
/**
 * Content-Security-Policy (Report-Only).
 *
 * Shipped in REPORT-ONLY mode so it breaks nothing while we confirm the
 * third-party allowlist in production (violations surface in the browser
 * console / any report endpoint). To ENFORCE later, change the header key
 * from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`
 * (and ideally move to per-request nonces for scripts).
 *
 * Allowlist covers: Supabase (REST + realtime ws), Sentry, PostHog,
 * Microsoft Clarity, Razorpay checkout, Cloudflare Turnstile, Jitsi video,
 * and Google Fonts.
 */
const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://*.razorpay.com https://*.posthog.com https://*.clarity.ms https://www.clarity.ms https://challenges.cloudflare.com https://*.jit.si https://meet.jit.si",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://images.unsplash.com https://avatars.githubusercontent.com https://*.supabase.co https://*.razorpay.com https://*.clarity.ms",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io https://*.posthog.com https://*.clarity.ms https://api.razorpay.com https://*.razorpay.com https://challenges.cloudflare.com",
  "frame-src 'self' https://*.razorpay.com https://api.razorpay.com https://challenges.cloudflare.com https://*.posthog.com https://posthog.com https://preview.posthog.com https://vercel.com https://*.jit.si https://meet.jit.si",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  // Disable Chrome's deprecated XSS-Auditor (modern browsers ignore it
  // and the legacy heuristic itself was a known XS-Leak vector).
  { key: "X-XSS-Protection", value: "0" },
  // Cross-origin isolation hardening.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  // XSS containment — report-only first (see cspReportOnly above).
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),

  /**
   * Ship the marketing knowledge pages (docs / privacy / terms) into the
   * serverless function bundle. The in-app AI assistant reads their prose at
   * runtime to answer product/support questions; Next.js does NOT include raw
   * `src/**` source files in functions by default, which left docs answers
   * blank in production even though the model was working.
   */
  outputFileTracingIncludes: {
    "/**": [
      "./src/app/(marketing)/docs/page.tsx",
      "./src/app/(marketing)/privacy/page.tsx",
      "./src/app/(marketing)/terms/page.tsx",
    ],
  },

  /**
   * Keep heavy server-only packages out of the client bundle entirely.
   * Next.js would otherwise attempt to bundle these into the edge runtime
   * or client chunks, massively bloating the JS payload.
   */
  serverExternalPackages: [
    "@react-pdf/renderer",
    "nodemailer",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
  ],

  experimental: {
    /**
     * Tree-shake barrel-export packages at build time.
     *
     * Packages like `lucide-react` re-export hundreds of icons from a
     * single index — without this flag, Next.js may pull the entire
     * namespace into every chunk that imports even one symbol. With it,
     * the compiler rewrites `import { X } from "pkg"` to the deep import
     * path so only the referenced exports are bundled.
     *
     * Similarly, each `@radix-ui/*` package has a barrel index; explicit
     * optimisation keeps those out of chunks that don't reference them.
     */
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "framer-motion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
    ],
  },
  async redirects() {
    return [
      {
        // Conventional favicon.ico path — many crawlers, bookmark managers
        // and browser address bars look here before respecting <link rel="icon">.
        source: "/favicon.ico",
        destination: "/api/pwa-icon/32",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        // Apply to every route, including API routes.
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // The browser must always re-fetch the SW script to detect updates.
        // Without no-store it can cache the old worker indefinitely.
        // Service-Worker-Allowed: / confirms the scope explicitly.
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // PWA icons — long-lived immutable cache; the hash is embedded in the
        // URL query string for maskable variants. Chrome and Samsung Internet
        // validate these during manifest parsing to confirm installability.
        source: "/api/pwa-icon/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=3600",
          },
        ],
      },
    ];
  },
};

/**
 * Conditionally wrap with Sentry's Next.js plugin.
 *
 * `withSentryConfig` rewrites the module tree to upload source maps
 * during `next build` and patches server actions for automatic error
 * capture. We only apply it when all build-time Sentry credentials are
 * present so CI and local builds without Sentry credentials keep working.
 */
function applySentry(config: NextConfig): NextConfig {
  const authToken = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;

  if (!authToken || !org || !project) {
    return config;
  }

  return withSentryConfig(config, {
    // Silence build-time output when there's no DSN configured.
    silent: !process.env.NEXT_PUBLIC_SENTRY_DSN,
    org,
    project,
    authToken,
    // Upload source maps but DO NOT expose them publicly. v10's
    // sourcemaps options replace the older `hideSourceMaps` flag.
    widenClientFileUpload: true,
    sourcemaps: {
      deleteSourcemapsAfterUpload: true,
    },
    webpack: {
      treeshake: {
        removeDebugLogging: true,
      },
    },
  });
}

export default applySentry(nextConfig);
