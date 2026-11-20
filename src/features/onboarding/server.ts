import "server-only";

/**
 * Server-side reads + guards for the onboarding domain.
 *
 * Mutations live in `./actions.ts` so they can be marked `"use server"`.
 * Reads here are usable from any RSC / route handler.
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { getProfile } from "@/features/profile/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { BusinessProfile } from "./types";
import { ONBOARDING_BASE, pathForStep } from "./routes";

/**
 * Returns the authenticated user's full business profile, or null when
 * unauthenticated.
 */
export async function getBusinessProfile(): Promise<BusinessProfile | null> {
  return getProfile();
}

/**
 * Get the user's current organization ID from cookie or default to personal org.
 */
export async function getCurrentOrganizationId(): Promise<string | null> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("stackivo_current_org_id")?.value;
  if (orgId) return orgId;

  // Fallback: get user's first organization (personal org)
  // Use admin client to avoid circular dependency
  const supabase = getAdminSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_user_id", user.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

/**
 * Redirect to the appropriate onboarding step when the user hasn't finished.
 * Use inside the dashboard layout's RSC to enforce "no dashboard until
 * onboarded".
 */
export async function requireOnboarded(): Promise<BusinessProfile & { currentOrgId: string }> {
  const profile = await getBusinessProfile();
  if (!profile) redirect(AUTH_LOGIN_ROUTE);
  if (!profile.onboardingCompleted) {
    redirect(pathForStep(profile.onboardingStep));
  }

  const currentOrgId = await getCurrentOrganizationId();
  if (!currentOrgId) {
    // User has no organization - redirect to create one
    redirect("/dashboard/organizations/new");
  }

  return { ...profile, currentOrgId };
}

/**
 * Counterpart used inside the onboarding layout: if the user is already
 * onboarded we send them to the dashboard. Otherwise we make sure their URL
 * matches the persisted current step (resume capability).
 */
export async function requireMidOnboarding(
  currentPathname: string,
): Promise<BusinessProfile> {
  const cookieStore = await cookies();
  const portalReturnTo = cookieStore.get("stackivo_portal_return_to")?.value;
  if (portalReturnTo?.startsWith("/portal")) {
    redirect(portalReturnTo);
  }

  const profile = await getBusinessProfile();
  if (!profile) redirect(AUTH_LOGIN_ROUTE);
  if (profile.onboardingCompleted) redirect("/dashboard");

  const expected = pathForStep(profile.onboardingStep);
  // Allow the index `/onboarding` page to redirect itself; otherwise force
  // the user back to the step they're actually on.
  if (
    currentPathname === ONBOARDING_BASE ||
    currentPathname.startsWith(`${ONBOARDING_BASE}/`)
  ) {
    if (currentPathname !== expected && currentPathname !== ONBOARDING_BASE) {
      redirect(expected);
    }
  }
  return profile;
}
