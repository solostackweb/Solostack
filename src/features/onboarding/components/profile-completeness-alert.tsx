import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BusinessProfile } from "../types";

/**
 * Lightweight banner that surfaces missing critical business-profile data
 * AFTER onboarding has been marked complete (e.g. user skipped optional
 * fields and we want them to revisit). Renders nothing when the profile
 * has everything we expect.
 *
 * Layout strategy:
 *   - Mobile (< sm): single-row pill that links to Settings. Title only,
 *     no supporting copy, no separate button — taps the whole pill.
 *   - sm+: full alert with title, supporting copy, and an "Update" CTA.
 */
export function ProfileCompletenessAlert({
  profile,
}: {
  profile: BusinessProfile;
}) {
  const issues: string[] = [];
  if (!profile.legalName) issues.push("legal name");
  if (!profile.stateCode) issues.push("state");
  if (profile.gstRegistered && !profile.gstin) issues.push("GSTIN");

  if (issues.length === 0) return null;

  return (
    <>
      {/* Mobile compact pill. */}
      <Link
        href="/dashboard/settings/company"
        className="flex items-center gap-2.5 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm transition hover:bg-warning/10 sm:hidden"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium">
          Profile missing {issues.join(", ")}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>

      {/* Desktop / tablet full alert. */}
      <div className="hidden items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm sm:flex">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div className="flex-1 space-y-1">
          <p className="font-medium text-foreground">
            Your business profile is missing {issues.join(", ")}.
          </p>
          <p className="text-muted-foreground">
            Add it in settings so your invoices and contracts stay compliant.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/settings/company">Update</Link>
        </Button>
      </div>
    </>
  );
}
