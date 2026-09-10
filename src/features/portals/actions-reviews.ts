"use server";

import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  PortalAccessError,
  requirePortalAccess,
} from "@/features/portals/server";
import type { ActionResult } from "@/features/invoices/delivery";
import type { PortalReviewRow } from "@/lib/supabase/types";

const REVIEW_RATING = z.number().int().min(1).max(5);

const reviewSchema = z.object({
  portalId: z.string().uuid(),
  projectId: z.string().uuid(),
  rating: REVIEW_RATING,
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
});

function mapAccessError(err: PortalAccessError): string {
  switch (err.code) {
    case "unauthenticated":
      return "Please sign in.";
    case "forbidden":
      return "You don't have permission to do that.";
    case "not_found":
      return "Portal not found.";
  }
}

// -----------------------------------------------------------------------------
// POST a review
// -----------------------------------------------------------------------------

export async function createPortalReviewAction(
  input: z.infer<typeof reviewSchema>,
): Promise<
  | { ok: true; data: { reviewId: string }; message?: string }
  | { ok: false; error: string }
> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const d = parsed.data;

  const access = await requirePortalAccess(d.portalId).catch(
    (e) => e as PortalAccessError,
  );
  if (access instanceof PortalAccessError) {
    return { ok: false, error: mapAccessError(access) };
  }

  // Only clients (non-owners) can create reviews
  if (access.role === "owner") {
    return { ok: false, error: "Freelancers cannot review their own projects." };
  }

  // Check if client can review this project
  const admin = getAdminSupabase();
  const { data: canReview } = await admin.rpc("can_client_review_project", {
    p_portal_id: d.portalId,
    p_user_id: access.userId,
    p_project_id: d.projectId,
  } as never);

  if (!canReview) {
    return {
      ok: false,
      error:
        "You can only review completed projects in your portal that you haven't already reviewed.",
    };
  }

  const { data: row, error } = await admin
    .from("portal_reviews")
    .insert({
      portal_id: d.portalId,
      project_id: d.projectId,
      author_id: access.userId,
      rating: d.rating,
      title: d.title,
      body: d.body,
    } as never)
    .select("id")
    .single();

  if (error || !row) {
    return {
      ok: false,
      error: error?.message ?? "Could not submit review.",
    };
  }

  return {
    ok: true,
    data: { reviewId: (row as { id: string }).id },
    message: "Review submitted. Thank you for your feedback!",
  };
}

// -----------------------------------------------------------------------------
// GET reviews for a portal
// -----------------------------------------------------------------------------

export async function getPortalReviewsAction(
  input: { portalId: string; limit?: number },
): Promise<
  | { ok: true; data: { reviews: Array<PortalReviewRow & { author_name: string; author_email: string; project_title: string }> } }
  | { ok: false; error: string }
> {
  const parsed = z
    .object({
      portalId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).optional(),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Invalid portal ID." };
  }

  const access = await requirePortalAccess(parsed.data.portalId).catch(
    (e) => e as PortalAccessError,
  );
  if (access instanceof PortalAccessError) {
    return { ok: false, error: mapAccessError(access) };
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin.rpc("get_reviews_for_portal", {
    p_portal_id: parsed.data.portalId,
    p_limit: parsed.data.limit ?? 50,
  } as never);

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    data: { reviews: (data ?? []) as Array<PortalReviewRow & { author_name: string; author_email: string; project_title: string }> },
  };
}

// -----------------------------------------------------------------------------
// GET reviews for public profile
// -----------------------------------------------------------------------------

export async function getPublicProfileReviewsAction(
  input: { userId: string; limit?: number },
): Promise<
  | { ok: true; data: { reviews: Array<{ id: string; portal_id: string; project_id: string; rating: number; title: string; body: string; created_at: string; project_name: string; client_name: string }> } }
  | { ok: false; error: string }
> {
  const parsed = z
    .object({
      userId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).optional(),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Invalid user ID." };
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin.rpc("get_reviews_for_public_profile", {
    p_user_id: parsed.data.userId,
    p_limit: parsed.data.limit ?? 20,
  } as never);

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    data: {
      reviews: (data ?? []) as Array<{
        id: string;
        portal_id: string;
        project_id: string;
        rating: number;
        title: string;
        body: string;
        created_at: string;
        project_name: string;
        client_name: string;
      }>,
    },
  };
}

// -----------------------------------------------------------------------------
// Check if client can review a project
// -----------------------------------------------------------------------------

export async function canClientReviewProjectAction(
  input: { portalId: string; projectId: string },
): Promise<
  | { ok: true; data: { canReview: boolean; reason?: string } }
  | { ok: false; error: string }
> {
  const parsed = z
    .object({
      portalId: z.string().uuid(),
      projectId: z.string().uuid(),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  const access = await requirePortalAccess(parsed.data.portalId).catch(
    (e) => e as PortalAccessError,
  );
  if (access instanceof PortalAccessError) {
    return { ok: false, error: mapAccessError(access) };
  }

  if (access.role === "owner") {
    return { ok: true, data: { canReview: false, reason: "Freelancers cannot review their own projects." } };
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin.rpc("can_client_review_project", {
    p_portal_id: parsed.data.portalId,
    p_user_id: access.userId,
    p_project_id: parsed.data.projectId,
  } as never);

  if (error) return { ok: false, error: error.message };

  return { ok: true, data: { canReview: data ?? false } };
}

// -----------------------------------------------------------------------------
// Update a review (author only)
// -----------------------------------------------------------------------------

const updateSchema = z.object({
  portalId: z.string().uuid(),
  reviewId: z.string().uuid(),
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(4000).optional(),
});

export async function updatePortalReviewAction(
  input: z.infer<typeof updateSchema>,
): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const admin = getAdminSupabase();
  const { data: existing } = await admin
    .from("portal_reviews")
    .select("author_id, portal_id")
    .eq("id", parsed.data.reviewId)
    .maybeSingle();

  const review = existing as { author_id: string; portal_id: string } | null;
  if (!review) return { ok: false, error: "Review not found." };
  const { data: { user } } = await getAdminSupabase().auth.getUser();
  if (review.author_id !== user?.id) {
    return { ok: false, error: "You can only edit your own reviews." };
  }

  const access = await requirePortalAccess(review.portal_id).catch(
    (e) => e as PortalAccessError,
  );
  if (access instanceof PortalAccessError) {
    return { ok: false, error: mapAccessError(access) };
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.rating !== undefined) patch.rating = parsed.data.rating;
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.body !== undefined) patch.body = parsed.data.body;

  const { error } = await admin
    .from("portal_reviews")
    .update(patch as never)
    .eq("id", parsed.data.reviewId)
    .eq("author_id", access.userId);

  if (error) return { ok: false, error: error.message };

  return { ok: true, message: "Review updated." };
}

// -----------------------------------------------------------------------------
// Delete a review (freelancer only)
// -----------------------------------------------------------------------------

export async function deletePortalReviewAction(
  input: { portalId: string; reviewId: string },
): Promise<ActionResult> {
  const parsed = z
    .object({
      portalId: z.string().uuid(),
      reviewId: z.string().uuid(),
    })
    .safeParse(input);

  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const access = await requirePortalAccess(parsed.data.portalId, { requireRole: "owner" }).catch(
    (e) => e as PortalAccessError,
  );
  if (access instanceof PortalAccessError) {
    return { ok: false, error: mapAccessError(access) };
  }

  const admin = getAdminSupabase();
  const { error } = await admin
    .from("portal_reviews")
    .delete()
    .eq("id", parsed.data.reviewId)
    .eq("portal_id", parsed.data.portalId);

  if (error) return { ok: false, error: error.message };

  return { ok: true, message: "Review deleted." };
}