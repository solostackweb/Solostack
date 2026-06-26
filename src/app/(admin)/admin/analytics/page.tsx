/**
 * /admin/analytics — embedded PostHog dashboard.
 *
 * Per the audit: don't rebuild what PostHog already does. We just
 * iframe the public dashboard URL set in the POSTHOG_DASHBOARD_URL
 * environment variable. If it's not set, render a setup nudge.
 */

import { AdminPageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const trimmed = (process.env.POSTHOG_DASHBOARD_URL ?? "").trim();

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col space-y-3">
      <AdminPageHeader
        title="Analytics"
        subtitle="Embedded PostHog dashboard"
      />

      {!trimmed ? (
        <div className="rounded-md border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
          <p className="mb-2">
            No PostHog dashboard URL configured.
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Open PostHog → Dashboards → pick a dashboard.</li>
            <li>
              Click <strong>Share</strong> → enable a public-share link.
            </li>
            <li>
              Add <code>POSTHOG_DASHBOARD_URL=&lt;url&gt;</code> to your Vercel environment variables.
            </li>
            <li>Redeploy and reload this page.</li>
          </ol>
        </div>
      ) : (
        <iframe
          src={trimmed}
          className="w-full flex-1 rounded-xl border bg-card shadow-sm shadow-black/[0.03]"
          loading="lazy"
          title="PostHog dashboard"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      )}
    </div>
  );
}
