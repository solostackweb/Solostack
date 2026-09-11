import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getCurrentUser } from "@/features/auth/server";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import type { UserProfileRow } from "@/lib/supabase/types";
import { mapProfileRow, type BusinessProfile, type PortfolioItem } from "@/features/onboarding/types";
import { createSignedStorageUrl } from "./storage";

const fetchProfileRow = cache(async (): Promise<UserProfileRow | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return (data as unknown as UserProfileRow | null) ?? null;
});

const fetchPortfolio = cache(async (userId: string): Promise<PortfolioItem[]> => {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("public_portfolio_items")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  return (data ?? []) as PortfolioItem[];
});

/**
 * Resolve the current user's business profile + signed avatar/logo URLs.
 *
 * Wrapped in React's request-scoped `cache()` so layout + page + any
 * server component that reads the profile within the same request shares
 * one execution (avoids re-signing storage URLs and re-querying the row).
 */
export const getProfile = cache(
  async (): Promise<BusinessProfile | null> => {
    const row = await fetchProfileRow();
    if (!row) return null;
    const base = mapProfileRow(row);
    const supabase = await getServerSupabase();
    const [avatarUrl, logoUrl, brandIconUrl, portfolio] = await Promise.all([
      createSignedStorageUrl("profile-images", base.avatarPath, supabase),
      createSignedStorageUrl("branding-assets", base.logoPath, supabase),
      createSignedStorageUrl("branding-assets", base.brandIconPath, supabase),
      fetchPortfolio(base.userId),
    ]);
    return {
      ...base,
      avatarUrl,
      logoUrl,
      brandIconUrl,
      portfolio,
    };
  },
);

export async function requireProfile(): Promise<BusinessProfile> {
  const profile = await getProfile();
  if (!profile) redirect(AUTH_LOGIN_ROUTE);
  return profile;
}
