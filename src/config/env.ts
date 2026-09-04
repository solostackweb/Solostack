/**
 * Typed, validated access to environment variables.
 *
 * - Throws at import time if a required var is missing, so missing config
 *   fails fast in dev and during build instead of at runtime in a request.
 * - `NEXT_PUBLIC_*` vars are inlined by Next.js at build time and are safe
 *   in both server and client bundles.
 * - Server-only secrets are read via `requireServerEnv()` which is ONLY
 *   importable from server components, route handlers, server actions, and
 *   middleware. Never import `env.server` from a Client Component.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `[env] Missing required environment variable: ${name}. ` +
        `See .env.example for the full list.`,
    );
  }
  return value;
}

function optional(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

/**
 * Public environment — safe to use in both server and client bundles.
 * All keys MUST be prefixed with `NEXT_PUBLIC_`.
 */
export const env = {
  appUrl: required("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL),
  appName:
    process.env.NEXT_PUBLIC_APP_NAME && process.env.NEXT_PUBLIC_APP_NAME.length > 0
      ? process.env.NEXT_PUBLIC_APP_NAME
      : "Stackivo",
  supabaseUrl: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  supabaseAnonKey: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  // ---- Observability (all optional, graceful no-op when unset) ----------
  // Sentry browser DSN. Must be NEXT_PUBLIC_ so the client bundle can init.
  sentryDsn: optional(process.env.NEXT_PUBLIC_SENTRY_DSN) ?? "",
  // PostHog client key + host. EU host = https://eu.i.posthog.com.
  posthogKey: optional(process.env.NEXT_PUBLIC_POSTHOG_KEY) ?? "",
  posthogHost:
    optional(process.env.NEXT_PUBLIC_POSTHOG_HOST) ?? "https://eu.i.posthog.com",
  // Commit SHA for release tagging in Sentry / PostHog / logs.
  // Vercel populates VERCEL_GIT_COMMIT_SHA automatically.
  commitSha:
    optional(process.env.NEXT_PUBLIC_COMMIT_SHA) ??
    optional(process.env.VERCEL_GIT_COMMIT_SHA) ??
    "dev",
  // Runtime environment tag for events + logs.
  runtimeEnv:
    optional(process.env.NEXT_PUBLIC_RUNTIME_ENV) ??
    optional(process.env.VERCEL_ENV) ??
    process.env.NODE_ENV ??
    "development",
  // Microsoft Clarity project id. Free unlimited heatmaps + scroll +
  // click + session replay; complements PostHog product analytics.
  // Browser-safe by design. Unset → script never loads.
  clarityProjectId: optional(process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID) ?? "",
  // Cal.com booking link for the founder-call slot. Embedded at /talk.
  // Format: https://cal.com/<handle>/<event>.
  // Unset → /talk renders an honest "coming soon" stub with the
  // contact form + email fallback.
  calComUrl: optional(process.env.NEXT_PUBLIC_CAL_COM_URL) ?? "",
  // YouTube or Loom demo URL. NEXT_PUBLIC_DEMO_VIDEO_URL is preferred;
  // the former Loom-specific name remains as a deployment-safe fallback.
  // Unset → /demo renders a placeholder with a sign-up CTA.
  demoVideoUrl:
    optional(process.env.NEXT_PUBLIC_DEMO_VIDEO_URL) ??
    optional(process.env.NEXT_PUBLIC_LOOM_DEMO_URL) ??
    "",
  // Web Push public VAPID key. Browser-safe (it is the *public* key).
  // Unset → the portal's "Enable notifications" affordance hides itself and
  // push silently no-ops, exactly like the other optional integrations.
  vapidPublicKey: optional(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) ?? "",
  // Cloudflare Turnstile public site key. Browser-safe by design.
  // Unset -> challenge widgets do not render and server checks skip in dev.
  turnstileSiteKey: optional(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) ?? "",
} as const;

export type PublicEnv = typeof env;

/**
 * Server-only environment. Calling this from a client bundle will throw.
 * Only import from server components, route handlers, server actions,
 * and middleware.
 */
export function requireServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error(
      "[env] requireServerEnv() was called from a client context. " +
        "Move the call into a Server Component, route handler, or server action.",
    );
  }

  return {
    ...env,
    supabaseServiceRoleKey: required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    googleOAuthClientId: optional(process.env.GOOGLE_OAUTH_CLIENT_ID),
    googleOAuthClientSecret: optional(process.env.GOOGLE_OAUTH_CLIENT_SECRET),
    razorpayKeyId: optional(process.env.RAZORPAY_KEY_ID),
    razorpayKeySecret: optional(process.env.RAZORPAY_KEY_SECRET),
    razorpayWebhookSecret: optional(process.env.RAZORPAY_WEBHOOK_SECRET),
    razorpayPlanProMonthly: optional(process.env.RAZORPAY_PLAN_PRO_MONTHLY),
    razorpayPlanProYearly: optional(process.env.RAZORPAY_PLAN_PRO_YEARLY),
    razorpayPlanBusinessMonthly: optional(
      process.env.RAZORPAY_PLAN_BUSINESS_MONTHLY,
    ),
    razorpayPlanBusinessYearly: optional(
      process.env.RAZORPAY_PLAN_BUSINESS_YEARLY,
    ),
    // Web Push (VAPID). All optional — push gracefully no-ops when unset.
    vapidPublicKey: optional(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    vapidPrivateKey: optional(process.env.VAPID_PRIVATE_KEY),
    vapidSubject:
      optional(process.env.VAPID_SUBJECT) ?? "mailto:support@stackivo.me",
    brevoTransport:
      process.env.BREVO_TRANSPORT === "smtp" ? "smtp" : "api",
    brevoApiKey: optional(process.env.BREVO_API_KEY),
    brevoSenderEmail: optional(process.env.BREVO_SENDER_EMAIL),
    brevoSenderName: process.env.BREVO_SENDER_NAME ?? "Stackivo",
    brevoSmtpHost:
      optional(process.env.BREVO_SMTP_HOST) ?? "smtp-relay.brevo.com",
    brevoSmtpPort: process.env.BREVO_SMTP_PORT
      ? Number(process.env.BREVO_SMTP_PORT)
      : 587,
    brevoSmtpSecure:
      process.env.BREVO_SMTP_SECURE === "true" ||
      process.env.BREVO_SMTP_SECURE === "1",
    brevoSmtpUser: optional(process.env.BREVO_SMTP_USER),
    brevoSmtpPassword: optional(process.env.BREVO_SMTP_PASSWORD),
    // Upstash Redis (optional) — when set, enables production rate
    // limiting on login / signup / password-reset / public-sign endpoints.
    // Provision at https://upstash.com → Create database → REST API page.
    upstashRedisUrl: optional(process.env.UPSTASH_REDIS_REST_URL),
    upstashRedisToken: optional(process.env.UPSTASH_REDIS_REST_TOKEN),
    // Brevo webhook shared secret. Sent in the `?token=` query parameter
    // configured on the Brevo webhook subscription. `/api/webhooks/brevo`
    // rejects any request without a timing-safe match.
    brevoWebhookSecret: optional(process.env.BREVO_WEBHOOK_SECRET),
    // Shared secret the Cloudflare Email Worker presents (Bearer) when POSTing
    // parsed inbound support email to /api/support/inbound.
    supportInboundSecret: optional(process.env.SUPPORT_INBOUND_SECRET),
    // Cloudflare Turnstile secret key for server-side token verification.
    // Pair with NEXT_PUBLIC_TURNSTILE_SITE_KEY. Unset -> verification is skipped.
    turnstileSecretKey: optional(process.env.TURNSTILE_SECRET_KEY),
    // Ops / observability (all optional) -----------------------------------
    // Slack incoming webhook for cron-based failure alerts. Unset → no-op.
    opsSlackWebhookUrl: optional(process.env.OPS_SLACK_WEBHOOK_URL),
    // Shared secret required by `/api/cron/*` route handlers. External
    // schedulers should include this via the `Authorization: Bearer <CRON_SECRET>`
    // header when calling the endpoint over HTTP.
    cronSecret: optional(process.env.CRON_SECRET),
    // Sentry server auth token (build-time only — uploads source maps
    // during `next build`). Not used at runtime.
    sentryAuthToken: optional(process.env.SENTRY_AUTH_TOKEN),
    // Hard kill-switch for outbound transactional email.
    //   - Unset       → live in production (NODE_ENV=production), dry-run
    //                   everywhere else. Safe default.
    //   - "true"      → force live sending (only set in production).
    //   - "false"     → force dry-run (emails log to delivery_logs with
    //                   status='failed' + error='dry_run' and never hit
    //                   the provider).
    emailLiveMode:
      process.env.EMAIL_LIVE_MODE === "true"
        ? true
        : process.env.EMAIL_LIVE_MODE === "false"
          ? false
          : process.env.NODE_ENV === "production",
    // Brevo contact list id for the marketing newsletter / lead capture
    // forms. Numeric (e.g. "12"). Unset → leads are still captured to
    // delivery_logs metadata but not added to a Brevo list, so subscription
    // forms succeed and the founder gets the lead in support@.
    brevoNewsletterListId: optional(process.env.BREVO_NEWSLETTER_LIST_ID),
    // -- Stackivo AI workflows ----------------------------------------------
    // Groq-hosted inference for contextual workflow draft generation. Optional:
    // when unset, AI workflow actions return a deterministic local draft so the
    // UI can still be exercised in dev without network access.
    groqApiKey: optional(process.env.GROQ_API_KEY),
    // Default to Groq's current production GPT-OSS model for structured
    // extraction and workflow drafting. Override via GROQ_MODEL if needed.
    groqModel:
      optional(process.env.GROQ_MODEL) ?? "openai/gpt-oss-120b",
    // -- Cloudflare R2 (Client Portal file storage) -----------------------
    // S3-compatible bucket for client-portal file uploads. We use R2
    // because it has zero egress fees, which lets us host customer
    // deliverables (designs, videos, archives) without metering bandwidth.
    // All values optional — when missing, the portal disables file
    // upload UI and the route handlers return a 503 with a clear message.
    r2AccountId: optional(process.env.R2_ACCOUNT_ID),
    r2AccessKeyId: optional(process.env.R2_ACCESS_KEY_ID),
    r2SecretAccessKey: optional(process.env.R2_SECRET_ACCESS_KEY),
    r2Bucket: optional(process.env.R2_BUCKET),
    // Optional CDN / public R2 URL prefix (e.g. https://files.stackivo.in).
    // When set, downloads are served from this domain instead of presigned
    // S3 URLs — better caching and a cleaner branded URL.
    r2PublicBaseUrl: optional(process.env.R2_PUBLIC_BASE_URL),
  } as const;
}

/**
 * Public-only Razorpay key id, exposed to the browser so the Razorpay
 * Checkout JS can be initialised.
 */
export const publicRazorpayKeyId =
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || undefined;

export type ServerEnv = ReturnType<typeof requireServerEnv>;
