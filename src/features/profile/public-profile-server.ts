import "server-only";

import { getAdminSupabase } from "@/lib/supabase/admin";

export interface PublicProfileData {
  id: string;
  public_slug: string;
  full_name: string | null;
  display_name: string | null;
  business_name: string | null;
  legal_name: string | null;
  role: string | null;
  bio: string | null;
  avatar_url: string | null;
  email: string | null;
  business_email: string | null;
  business_phone: string | null;
  website: string | null;
  brand_color: string | null;
  brand_tagline: string | null;
  brand_intro: string | null;
  public_bio: string | null;
  public_services: string[] | null;
  public_industries: string[] | null;
  public_location: string | null;
  public_languages: string[] | null;
  public_availability: string | null;
  public_starting_rate: number | null;
  public_starting_rate_currency: string | null;
  public_show_reviews: boolean | null;
  public_show_portfolio: boolean | null;
  public_show_stats: boolean | null;
  public_cta_text: string | null;
  public_cta_action: string | null;
  public_custom_domain: string | null;
  public_seo_title: string | null;
  public_seo_description: string | null;
  public_og_image: string | null;
  created_at: string;
}

export interface PublicProfileStats {
  completed_projects: number;
  verified_reviews: number;
  average_rating: number | null;
  repeat_clients: number;
  total_project_value: number;
  on_time_delivery_rate: number | null;
}

export interface PublicPortfolioItem {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  images: string[] | null;
  category: string | null;
  industry: string | null;
  budget_range: string | null;
  duration: string | null;
  technologies: string[] | null;
  client_name: string | null;
  client_industry: string | null;
  testimonial: string | null;
  featured: boolean | null;
  sort_order: number | null;
  created_at: string;
}

export interface PublicProfileReview {
  id: string;
  portal_id: string;
  project_id: string;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  project_name: string | null;
  client_name: string | null;
}

/**
 * Get public profile by slug
 */
export async function getPublicProfileBySlug(
  slug: string
): Promise<PublicProfileData | null> {
  const admin = getAdminSupabase();
  const { data } = await admin.rpc("get_public_profile", {
    p_slug: slug,
  } as never) as { data: PublicProfileData[] | PublicProfileData | null };

  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Get public profile stats
 */
export async function getPublicProfileStats(
  userId: string
): Promise<PublicProfileStats | null> {
  const admin = getAdminSupabase();
  const { data } = await admin.rpc("get_public_profile_stats", {
    p_user_id: userId,
  } as never) as { data: PublicProfileStats[] | PublicProfileStats | null };

  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Get public portfolio items
 */
export async function getPublicPortfolio(
  userId: string,
  limit = 12
): Promise<PublicPortfolioItem[]> {
  const admin = getAdminSupabase();
  const { data } = await admin.rpc("get_public_portfolio", {
    p_user_id: userId,
    p_limit: limit,
  } as never);

  return (data ?? []) as PublicPortfolioItem[];
}

/**
 * Get public profile reviews
 */
export async function getPublicProfileReviews(
  userId: string,
  limit = 10
): Promise<PublicProfileReview[]> {
  const admin = getAdminSupabase();
  const { data } = await admin.rpc("get_public_profile_reviews", {
    p_user_id: userId,
    p_limit: limit,
  } as never);

  return (data ?? []) as PublicProfileReview[];
}

/**
 * Check if slug is available
 */
export async function checkSlugAvailable(
  slug: string,
  excludeUserId?: string
): Promise<{ available: boolean; reason?: string }> {
  const admin = getAdminSupabase();
  const { data } = await admin.rpc("check_slug_available", {
    p_slug: slug,
    p_exclude_user_id: excludeUserId ?? null,
  } as never);

  return { available: data ?? false };
}

/**
 * Claim a public slug
 */
export async function claimPublicSlug(
  userId: string,
  slug: string
): Promise<{ success: boolean; error?: string }> {
  const admin = getAdminSupabase();
  const { data } = await admin.rpc("claim_public_slug", {
    p_user_id: userId,
    p_slug: slug,
  } as never);

  return { success: data ?? false };
}