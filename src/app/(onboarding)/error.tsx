"use client";

/**
 * Onboarding-flow error boundary.
 *
 * Onboarding is a state machine across steps, so we keep the error UI
 * minimal and route the user back to the entry point. The dashboard
 * layout will redirect them to whichever step they last completed.
 */

import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    Sentry.captureException(error, {
      tags: { surface: "onboarding" },
    });
    console.error("[OnboardingError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Setup hit a snag</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Your progress is saved. Try again, or head to your dashboard
          and continue from there.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={reset}>
          Try again
        </Button>
        <Button asChild size="sm">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
      {error.digest ? (
        <p className="text-xs text-muted-foreground/60">
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
