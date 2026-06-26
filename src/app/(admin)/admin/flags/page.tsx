/**
 * /admin/flags — embedded PostHog feature-flags page.
 *
 * Same iframe pattern as /admin/analytics. The URL is read from
 * the POSTHOG_FLAGS_URL environment variable.
 */

import { AdminPageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export default async function AdminFlagsPage() {
  const trimmed = (process.env.POSTHOG_FLAGS_URL ?? "").trim();

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col space-y-3">
      <AdminPageHeader
        title="Feature flags"
        subtitle="Embedded PostHog feature-flags view"
      />

      {!trimmed ? (
        <div className="rounded-md border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
          <p className="mb-2">No PostHog feature-flags URL configured.</p>
          <p>
            Add <code>POSTHOG_FLAGS_URL=&lt;url&gt;</code> to your Vercel environment variables
            and redeploy. Note: PostHog&apos;s feature-flags page requires an authenticated
            browser session, so the iframe may show a login screen until you sign in
            to PostHog in another tab.
          </p>
        </div>
      ) : (
        <iframe
          src={trimmed}
          className="w-full flex-1 rounded-xl border bg-card shadow-sm shadow-black/[0.03]"
          loading="lazy"
          title="PostHog feature flags"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      )}
    </div>
  );
}
