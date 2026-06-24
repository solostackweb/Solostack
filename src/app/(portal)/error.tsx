"use client";

/**
 * Client-portal error boundary. Portal visitors are the freelancer's own
 * clients, so this stays calm and unbranded-technical — no stack traces.
 */

import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    Sentry.captureException(error, { tags: { surface: "portal" } });
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Something went wrong</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          This page didn&rsquo;t load correctly. Please try again — if it keeps
          happening, contact the person who shared this portal with you.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={reset}>
        <RefreshCw className="mr-2 h-3.5 w-3.5" />
        Try again
      </Button>
      {error.digest ? (
        <p className="text-[11px] text-muted-foreground/60">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
