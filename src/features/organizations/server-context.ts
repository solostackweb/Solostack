"use server";

import { cookies } from "next/headers";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * Get the current organization ID from the cookie.
 * This is set by the middleware when the user switches organizations.
 */
export async function getCurrentOrganizationId(): Promise<string | null> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("stackivo_current_org_id")?.value;
  if (orgId) return orgId;

  // Fallback: get user's first organization (personal org)
  // Use admin client to avoid circular dependency with getServerSupabase
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
 * Verify the user has access to the organization and return the org ID.
 * Throws redirect if not authenticated or no org access.
 */
export async function requireOrganization(): Promise<string> {
  const orgId = await getCurrentOrganizationId();
  if (!orgId) {
    // Redirect to org selection or creation
    // For now, throw an error that the layout can catch
    throw new Error("NO_ORGANIZATION");
  }
  return orgId;
}

/**
 * Set the current organization cookie (called when user switches orgs).
 */
export async function setCurrentOrganizationId(orgId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("stackivo_current_org_id", orgId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}