"use server";

/**
 * Welcome Document server actions.
 *
 * Stays *deliberately* lean: every action validates input with Zod,
 * authenticates via `requireUserId`, and uses the user-scoped
 * Supabase client so RLS does the final authorization check.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { recordActivity } from "@/features/activity/server";
import { createNotification } from "@/features/notifications/server";
import { applyMergeFields } from "@/features/templates/merge-fields";
import { resolveMergeContextForUser } from "@/features/templates/merge-context";
import {
  parseWelcomeContent,
  serializeWelcomeContent,
} from "./content";
import {
  ensureWelcomePublicToken,
} from "./server";
import {
  WELCOME_DOCUMENTS_INDEX,
  welcomeDocumentDetail,
} from "./routes";
import type { WelcomeDocumentRow } from "@/lib/supabase/types";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function requireUserId(): Promise<string> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user.id;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const sectionSchema = z.object({
  heading: z.string().trim().max(200),
  body: z.string().max(20_000),
});

/**
 * Most of the editor lives client-side, so the wire format is JSON.
 * `content` is the canonical column shape (TEXT in the DB) — we
 * round-trip through `parseWelcomeContent` to validate.
 */
const docInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  intro: z.string().max(5_000).optional().nullable(),
  sections: z.array(sectionSchema).max(40),
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  brandColor: z
    .string()
    .regex(/^#?[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour.")
    .optional()
    .nullable(),
});

const idSchema = z.object({ id: z.string().uuid() });

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

export async function createWelcomeDocumentAction(
  input: z.input<typeof docInputSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = docInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  // Fill {{merge fields}} from the chosen client / project / profile.
  const mergeCtx = await resolveMergeContextForUser({
    userId,
    clientId: parsed.data.clientId,
    projectId: parsed.data.projectId,
  });

  const insertRow = {
    user_id: userId,
    title: applyMergeFields(parsed.data.title, mergeCtx),
    intro: parsed.data.intro
      ? applyMergeFields(parsed.data.intro, mergeCtx)
      : null,
    content: serializeWelcomeContent(
      parsed.data.sections.map((s, i) => ({
        id: `s_${i + 1}`,
        heading: applyMergeFields(s.heading, mergeCtx),
        body: applyMergeFields(s.body, mergeCtx),
      })),
    ),
    client_id: parsed.data.clientId ?? null,
    project_id: parsed.data.projectId ?? null,
    brand_color: normaliseColor(parsed.data.brandColor),
    status: "draft" as const,
  };

  const { data, error } = await supabase
    .from("welcome_documents")
    .insert(insertRow as never)
    .select("id")
    .single();
  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Could not create welcome document.",
    };
  }
  const id = (data as { id: string }).id;

  await recordActivity({
    kind: "welcome_document_created",
    entityType: "welcome_document",
    entityId: id,
    title: `Created welcome document: ${parsed.data.title}`,
  });

  revalidatePath(WELCOME_DOCUMENTS_INDEX);
  return { ok: true, data: { id }, message: "Welcome document saved." };
}

export async function updateWelcomeDocumentAction(
  input: { id: string } & z.input<typeof docInputSchema>,
): Promise<ActionResult> {
  const idCheck = idSchema.safeParse({ id: input.id });
  if (!idCheck.success) return { ok: false, error: "Invalid id." };
  const parsed = docInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const updateRow = {
    title: parsed.data.title,
    intro: parsed.data.intro ?? null,
    content: serializeWelcomeContent(
      parsed.data.sections.map((s, i) => ({
        id: `s_${i + 1}`,
        heading: s.heading,
        body: s.body,
      })),
    ),
    client_id: parsed.data.clientId ?? null,
    project_id: parsed.data.projectId ?? null,
    brand_color: normaliseColor(parsed.data.brandColor),
  };

  const { error } = await supabase
    .from("welcome_documents")
    .update(updateRow as never)
    .eq("id", input.id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(WELCOME_DOCUMENTS_INDEX);
  revalidatePath(welcomeDocumentDetail(input.id));
  return { ok: true, message: "Welcome document updated." };
}

// ---------------------------------------------------------------------------
// Lifecycle: publish / archive / delete / duplicate
// ---------------------------------------------------------------------------

export async function publishWelcomeDocumentAction(input: {
  id: string;
}): Promise<ActionResult<{ token: string }>> {
  const idCheck = idSchema.safeParse(input);
  if (!idCheck.success) return { ok: false, error: "Invalid id." };
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { data: row } = await supabase
    .from("welcome_documents")
    .select("id, title")
    .eq("id", input.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Document not found." };

  const token = await ensureWelcomePublicToken(input.id);
  if (!token) return { ok: false, error: "Could not mint share link." };

  await supabase
    .from("welcome_documents")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id);

  await recordActivity({
    kind: "welcome_document_published",
    entityType: "welcome_document",
    entityId: input.id,
    title: `Published welcome document: ${(row as { title: string }).title}`,
  });

  revalidatePath(WELCOME_DOCUMENTS_INDEX);
  revalidatePath(welcomeDocumentDetail(input.id));
  return { ok: true, data: { token }, message: "Published." };
}

export async function archiveWelcomeDocumentAction(input: {
  id: string;
}): Promise<ActionResult> {
  const idCheck = idSchema.safeParse(input);
  if (!idCheck.success) return { ok: false, error: "Invalid id." };
  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("welcome_documents")
    .update({ status: "archived" } as never)
    .eq("id", input.id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(WELCOME_DOCUMENTS_INDEX);
  revalidatePath(welcomeDocumentDetail(input.id));
  return { ok: true, message: "Archived." };
}

export async function deleteWelcomeDocumentAction(input: {
  id: string;
}): Promise<ActionResult> {
  const idCheck = idSchema.safeParse(input);
  if (!idCheck.success) return { ok: false, error: "Invalid id." };
  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("welcome_documents")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", input.id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(WELCOME_DOCUMENTS_INDEX);
  revalidatePath(welcomeDocumentDetail(input.id));
  return { ok: true, message: "Deleted." };
}

/**
 * Clone an existing document into a fresh draft. The clone gets a new
 * id, no public token, no view history — it's a brand-new draft. Used
 * for "Duplicate" in the list and "Create new version" workflows.
 */
export async function duplicateWelcomeDocumentAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const idCheck = idSchema.safeParse(input);
  if (!idCheck.success) return { ok: false, error: "Invalid id." };
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { data: original } = await supabase
    .from("welcome_documents")
    .select("*")
    .eq("id", input.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!original) return { ok: false, error: "Document not found." };
  const o = original as WelcomeDocumentRow;

  const { data: inserted, error } = await supabase
    .from("welcome_documents")
    .insert({
      user_id: userId,
      title: `${o.title} (copy)`,
      intro: o.intro,
      content: o.content,
      client_id: o.client_id,
      project_id: o.project_id,
      brand_color: o.brand_color,
      status: "draft",
    } as never)
    .select("id")
    .single();
  if (error || !inserted) {
    return {
      ok: false,
      error: error?.message ?? "Could not duplicate document.",
    };
  }

  revalidatePath(WELCOME_DOCUMENTS_INDEX);
  return {
    ok: true,
    data: { id: (inserted as { id: string }).id },
    message: "Duplicated.",
  };
}

/**
 * Persist the document's current sections as a personal template the
 * user can pick from when creating future welcome docs.
 */
export async function saveAsTemplateAction(input: {
  id: string;
  templateTitle: string;
  templateDescription?: string;
}): Promise<ActionResult<{ id: string }>> {
  const schema = z.object({
    id: z.string().uuid(),
    templateTitle: z.string().trim().min(1).max(120),
    templateDescription: z.string().max(500).optional(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { data: row } = await supabase
    .from("welcome_documents")
    .select("content, intro")
    .eq("id", parsed.data.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Document not found." };

  const { data: inserted, error } = await supabase
    .from("welcome_document_templates")
    .insert({
      user_id: userId,
      title: parsed.data.templateTitle,
      description: parsed.data.templateDescription ?? null,
      intro: (row as { intro: string | null }).intro,
      content: (row as { content: string }).content,
      is_system: false,
    } as never)
    .select("id")
    .single();
  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Could not save template." };
  }
  return {
    ok: true,
    data: { id: (inserted as { id: string }).id },
    message: "Template saved.",
  };
}

// ---------------------------------------------------------------------------
// Portal attachment
// ---------------------------------------------------------------------------

const portalAttachSchema = z.object({
  portalId: z.string().uuid(),
  documentId: z.string().uuid(),
});

export async function attachWelcomeToPortalAction(
  input: z.input<typeof portalAttachSchema>,
): Promise<ActionResult> {
  const parsed = portalAttachSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  // Defence in depth — verify ownership of *both* sides before writing
  // the link row. RLS would also catch it, but a clear error message
  // is better UX than a silent permission failure.
  const [docRes, portalRes] = await Promise.all([
    supabase
      .from("welcome_documents")
      .select("id")
      .eq("id", parsed.data.documentId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("portals")
      .select("id")
      .eq("id", parsed.data.portalId)
      .eq("owner_user_id", userId)
      .maybeSingle(),
  ]);
  if (!docRes.data) return { ok: false, error: "Document not found." };
  if (!portalRes.data) return { ok: false, error: "Portal not found." };

  const { error } = await supabase
    .from("portal_welcome_documents")
    .upsert(
      {
        portal_id: parsed.data.portalId,
        document_id: parsed.data.documentId,
        added_by: userId,
      } as never,
      { onConflict: "portal_id,document_id" },
    );
  if (error) return { ok: false, error: error.message };

  // Auto-publish if it's still a draft — attaching to a portal implies
  // the freelancer wants the client to see it.
  await supabase
    .from("welcome_documents")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
    } as never)
    .eq("id", parsed.data.documentId)
    .eq("status", "draft");

  await recordActivity({
    kind: "welcome_document_attached_to_portal",
    entityType: "welcome_document",
    entityId: parsed.data.documentId,
    title: "Welcome document attached to portal",
  });

  // Mirror the activity into the portal's own feed (RLS-bypassed admin
  // write). We deliberately don't notify the portal owner — they did
  // the action themselves.
  const admin = getAdminSupabase();
  await admin.from("portal_activity").insert({
    portal_id: parsed.data.portalId,
    actor_id: userId,
    type: "welcome_document.attached",
    metadata: { document_id: parsed.data.documentId },
  } as never);

  revalidatePath(`/dashboard/portal/${parsed.data.portalId}`);
  revalidatePath(`/portal/${parsed.data.portalId}`);
  revalidatePath(welcomeDocumentDetail(parsed.data.documentId));
  return { ok: true, message: "Attached to portal." };
}

export async function detachWelcomeFromPortalAction(
  input: z.input<typeof portalAttachSchema>,
): Promise<ActionResult> {
  const parsed = portalAttachSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const { data: portal } = await supabase
    .from("portals")
    .select("id")
    .eq("id", parsed.data.portalId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!portal) return { ok: false, error: "Portal not found." };

  const { error } = await supabase
    .from("portal_welcome_documents")
    .delete()
    .eq("portal_id", parsed.data.portalId)
    .eq("document_id", parsed.data.documentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/portal/${parsed.data.portalId}`);
  revalidatePath(`/portal/${parsed.data.portalId}`);
  return { ok: true, message: "Detached." };
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normaliseColor(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null;
}
