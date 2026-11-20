"use client";

import * as React from "react";
import { ProfileProvider } from "@/features/profile/context";
import { MobileNavProvider } from "./mobile-nav-context";
import { OrgProvider } from "@/features/organizations/context";
import type { BusinessProfile } from "@/features/onboarding/types";
import type { CurrentSubscription } from "@/features/subscription/types";

/**
 * Client-only providers wrapper for the dashboard shell.
 *
 * Keeping the providers in a thin client island means the surrounding
 * `DashboardShell` can stay a Server Component, which in turn allows any
 * future server-rendered chrome (server-side breadcrumbs, server-rendered
 * sidebar primary nav, etc.) to slot in without first crossing a client
 * boundary.
 */
export function DashboardShellProviders({
  profile,
  subscription,
  currentOrgId,
  children,
}: {
  profile: BusinessProfile;
  subscription: CurrentSubscription | null;
  currentOrgId: string;
  children: React.ReactNode;
}) {
  return (
    <ProfileProvider initialProfile={profile} initialSubscription={subscription}>
      <MobileNavProvider>
        <OrgProvider initialOrgId={currentOrgId}>{children}</OrgProvider>
      </MobileNavProvider>
    </ProfileProvider>
  );
}
