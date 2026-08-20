"use client";

/**
 * Public-route error boundary.
 *
 * Covers `/c/:token` (contract share) and `/i/:token` (invoice share).
 * Anonymous users won't have cookies or session, so we show a
 * standalone error page with no navigation back into the app — the
 * only way out is reloading or contacting the sender.
 */

import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    Sentry.captureException(error, {
      tags: { surface: "public-share" },
    });
    console.error("[PublicError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">
          We couldn&apos;t load this document
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          The link may have expired or the document may have been
          revoked. If this persists, ask the sender for a fresh link.
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
      >
        Try again
      </button>
      {error.digest ? (
        <p className="text-micro text-muted-foreground/60">
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
