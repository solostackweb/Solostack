"use client";

/** Admin-console error boundary. */

import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    Sentry.captureException(error, { tags: { surface: "admin" } });
    console.error("[AdminError]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Admin page error</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          This admin view failed to render. Try again; the error has been logged
          to Sentry.
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
