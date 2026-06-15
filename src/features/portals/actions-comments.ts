"use server";

import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  PortalAccessError,
  recordPortalActivity,
  requirePortalAccess,
} from "./server";
import type { ActionResult } from "@/features/invoices/delivery";
import type {
  PortalDocumentCommentRow,
  PortalDocumentType,
} from "@/lib/supabase/types";

const DOC_TYPES = ["contract", "invoice", "welcome"] as const;

function mapAccessError(err: PortalAccessError): string {
  switch (err.code) {
    case "unauthenticated": return "Please sign in.";
    case "forbidden":       return "You don't have permission to do that.";
    case "not_found":       return "Portal not found.";
  }
}

export type DocumentCommentWithAuthor = PortalDocumentCommentRow & {
  author: { full_name: string | null; email: string | null } | null;
};

// -----------------------------------------------------------------------------
// LIST comments for a document
// -----------------------------------------------------------------------------

export async function getDocumentCommentsAction(input: {
  portalId: string;
  docType: PortalDocumentType;
  docId: string;
}): Promise<ActionResult<{ comments: DocumentCommentWithAuthor[] }>> {
  const access = await requirePortalAccess(input.portalId).catch(
    (e) => e as PortalAccessError,
  );
  if (access instanceof PortalAccessError) {
    return { ok: false, error: mapAccessError(access) };
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("portal_document_comments")
    .select("*")
    .eq("portal_id", input.portalId)
    .eq("doc_type", input.docType)
    .eq("doc_id", input.docId)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as PortalDocumentCommentRow[];
  const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
  const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
  if (authorIds.length) {
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", authorIds);
    for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      profileMap.set(p.id, { full_name: p.full_name, email: p.email });
    }
  }

  return {
    ok: true,
    data: {
      comments: rows.map((r) => ({ ...r, author: profileMap.get(r.author_id) ?? null })),
    },
  };
}

// -----------------------------------------------------------------------------
// POST a comment
// -----------------------------------------------------------------------------

const postSchema = z.object({
  portalId: z.string().uuid(),
  docType: z.enum(DOC_TYPES),
  docId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export async function postDocumentCommentAction(
  input: z.infer<typeof postSchema>,
): Promise<ActionResult<{ commentId: string }>> {
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const access = await requirePortalAccess(parsed.data.portalId).catch(
    (e) => e as PortalAccessError,
  );
  if (access instanceof PortalAccessError) {
    return { ok: false, error: mapAccessError(access) };
  }

  const admin = getAdminSupabase();
  const { data: row, error } = await admin
    .from("portal_document_comments")
    .insert({
      portal_id: parsed.data.portalId,
      doc_type: parsed.data.docType,
      doc_id: parsed.data.docId,
      author_id: access.userId,
      body: parsed.data.body,
    } as never)
    .select("id")
    .single();
  if (error || !row) {
    return { ok: false, error: error?.message ?? "Could not post comment." };
  }

  await recordPortalActivity({
    portalId: parsed.data.portalId,
    actorId: access.userId,
    type: "document.commented",
    payload: {
      docType: parsed.data.docType,
      docId: parsed.data.docId,
      preview: parsed.data.body.slice(0, 80),
    },
  });

  return { ok: true, data: { commentId: (row as { id: string }).id } };
}

// -----------------------------------------------------------------------------
// RESOLVE / REOPEN a comment
// -----------------------------------------------------------------------------

export async function resolveDocumentCommentAction(input: {
  portalId: string;
  commentId: string;
  resolved: boolean;
}): Promise<ActionResult> {
  const access = await requirePortalAccess(input.portalId).catch(
    (e) => e as PortalAccessError,
  );
  if (access instanceof PortalAccessError) {
    return { ok: false, error: mapAccessError(access) };
  }
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("portal_document_comments")
    .update({ resolved_at: input.resolved ? new Date().toISOString() : null } as never)
    .eq("id", input.commentId)
    .eq("portal_id", input.portalId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// -----------------------------------------------------------------------------
// DELETE a comment (author or owner)
// -----------------------------------------------------------------------------

export async function deleteDocumentCommentAction(input: {
  portalId: string;
  commentId: string;
}): Promise<ActionResult> {
  const access = await requirePortalAccess(input.portalId).catch(
    (e) => e as PortalAccessError,
  );
  if (access instanceof PortalAccessError) {
    return { ok: false, error: mapAccessError(access) };
  }
  const admin = getAdminSupabase();
  const { data: existing } = await admin
    .from("portal_document_comments")
    .select("author_id")
    .eq("id", input.commentId)
    .eq("portal_id", input.portalId)
    .maybeSingle();
  const row = existing as { author_id: string } | null;
  if (!row) return { ok: false, error: "Comment not found." };
  if (row.author_id !== access.userId && access.role !== "owner") {
    return { ok: false, error: "You can only delete your own comments." };
  }
  const { error } = await admin
    .from("portal_document_comments")
    .delete()
    .eq("id", input.commentId)
    .eq("portal_id", input.portalId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
