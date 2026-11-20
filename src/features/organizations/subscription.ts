"use server";

import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export interface OrgSubscription {
  id: string;
  organization_id: string;
  plan: "free" | "pro" | "business" | "enterprise";
  status: "active" | "trialing" | "past_due" | "canceled" | "paused";
  trial_ends_at: string | null;
  current_period_end: string | null;
  razorpay_subscription_id: string | null;
  razorpay_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get the organization's subscription (org-level, not user-level).
 * Falls back to the owner's personal subscription if no org subscription exists.
 */
export async function getOrgSubscription(orgId: string): Promise<OrgSubscription | null> {
  const supabase = await getServerSupabase();
  
  // First check for org-level subscription
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (data && !error) {
    return data as unknown as OrgSubscription;
  }

  // Fallback: get owner's personal subscription
  const { data: org } = await supabase
    .from("organizations")
    .select("owner_user_id")
    .eq("id", orgId)
    .maybeSingle();

  if (org?.owner_user_id) {
    const { data: userSub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", org.owner_user_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (userSub) {
      return userSub as unknown as OrgSubscription;
    }
  }

  return null;
}

/**
 * Get all subscriptions for an organization (including member subscriptions if needed)
 */
export async function getOrgSubscriptions(orgId: string): Promise<OrgSubscription[]> {
  const admin = getAdminSupabase();
  
  const { data, error } = await admin
    .from("subscriptions")
    .select("*")
    .eq("organization_id", orgId)
    .is("deleted_at", null);

  if (error || !data) return [];
  return data as unknown as OrgSubscription[];
}

/**
 * Create or update organization subscription
 */
export async function upsertOrgSubscription(
  orgId: string,
  patch: Partial<Omit<OrgSubscription, "id" | "organization_id" | "created_at" | "updated_at">>
): Promise<OrgSubscription | null> {
  const admin = getAdminSupabase();

  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await admin
      .from("subscriptions")
      .update(patch as unknown as Database["public"]["Tables"]["subscriptions"]["Update"])
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error || !data) return null;
    return data as unknown as OrgSubscription;
  } else {
    const { data, error } = await admin
      .from("subscriptions")
      .insert({
        organization_id: orgId,
        plan: "free",
        status: "active",
        ...patch,
      } as never)
      .select("*")
      .single();

    if (error || !data) return null;
    return data as unknown as OrgSubscription;
  }
}

/**
 * Cancel organization subscription
 */
export async function cancelOrgSubscription(orgId: string): Promise<boolean> {
  const admin = getAdminSupabase();

  const { error } = await admin
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("organization_id", orgId);

  return !error;
}