import "server-only";

/**
 * Welcome Document server-side data layer.
 *
 * All reads go through `getServerSupabase()` so RLS scopes the result
 * to the calling user. Anonymous reads (the `/w/<token>` public viewer)
 * use the admin client because anonymous visitors don't have a JWT —
 * the public_token itself is the capability check.
 *
 * Write paths used by anonymous viewers (recordView, recordAck) ALSO
 * use the admin client to bypass RLS deliberately. Each one re-derives
 * the document from the supplied token before doing anything else.
 */

import { randomUUID, createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import type {
  WelcomeDocumentRow,
  WelcomeDocumentTemplateRow,
} from "@/lib/supabase/types";
import { parseWelcomeContent } from "./content";
import type {
  WelcomeDocumentRecord,
  WelcomeDocumentTemplate,
} from "./types";
import { BUILTIN_WELCOME_TEMPLATES } from "./templates";
import { listTemplates } from "@/features/templates/server";
import type { TemplateRecord, WelcomeDocTemplateContent } from "@/features/templates/builtin";

/** Hex token shape — same generator as invoices/contracts. */
const TOKEN_RE = /^[a-f0-9]{32}$/i;
export function isValidWelcomeToken(token: string): boolean {
  return TOKEN_RE.test(token);
}

/** Resolve the current user or redirect to login. */
async function requireUser() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user;
}

// ---------------------------------------------------------------------------
// Hydration helpers
// ---------------------------------------------------------------------------

/**
 * Build a `WelcomeDocumentRecord` from a raw row. Returns null if the
 * row is soft-deleted so callers don't have to repeat the check.
 */
async function hydrate(
  row: WelcomeDocumentRow,
): Promise<WelcomeDocumentRecord | null> {
  if (row.deleted_at) return null;
  const admin = getAdminSupabase();

  // Joined display names. We fetch only when we need them — most list
  // queries already join in SQL, but the single-record path uses this
  // helper which keeps the join surface tiny.
  const [clientRes, projectRes, viewsRes] = await Promise.all([
    row.client_id
      ? admin
          .from("clients")
          .select("full_name, business_name")
          .eq("id", row.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    row.project_id
      ? admin
          .from("projects")
          .select("name")
          .eq("id", row.project_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("welcome_document_views")
      .select("view_count")
      .eq("document_id", row.id),
  ]);

  const client = clientRes.data as
    | { full_name?: string | null; business_name?: string | null }
    | null;
  const project = projectRes.data as { name?: string | null } | null;
  const views = (viewsRes.data ?? []) as Array<{ view_count: number }>;

  return {
    id: row.id,
    userId: row.user_id,
    clientId: row.client_id,
    clientName: client?.full_name ?? client?.business_name ?? null,
    projectId: row.project_id,
    projectName: project?.name ?? null,
    title: row.title,
    intro: row.intro,
    sections: parseWelcomeContent(row.content),
    brandColor: row.brand_color,
    status: row.status,
    publicToken: row.public_token,
    version: row.version,
    parentId: row.parent_id,
    viewedAt: row.viewed_at,
    publishedAt: row.published_at,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    totalViews: views.reduce((sum, v) => sum + (v.view_count ?? 0), 0),
    uniqueViewers: views.length,
  };
}

// ---------------------------------------------------------------------------
// Owner-side reads
// ---------------------------------------------------------------------------

export async function listWelcomeDocuments(
  opts: { projectId?: string; clientId?: string } = {},
): Promise<WelcomeDocumentRecord[]> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  let query = supabase
    .from("welcome_documents")
    .select("*")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (opts.projectId) query = query.eq("project_id", opts.projectId);
  if (opts.clientId) query = query.eq("client_id", opts.clientId);
  const { data } = await query;

  const rows = (data ?? []) as WelcomeDocumentRow[];
  const records = await Promise.all(rows.map((r) => hydrate(r)));
  return records.filter((r): r is WelcomeDocumentRecord => r !== null);
}

export async function getWelcomeDocument(
  id: string,
): Promise<WelcomeDocumentRecord | null> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("welcome_documents")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return hydrate(data as WelcomeDocumentRow);
}

// ---------------------------------------------------------------------------
// Templates (system + per-user)
// ---------------------------------------------------------------------------

export async function listWelcomeTemplates(): Promise<
  WelcomeDocumentTemplate[]
> {
  // Both system templates (RLS allows everyone to read) and the user's
  // own saved templates surface here. Users see system first, then
  // their own (newest first).
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("welcome_document_templates")
    .select("*")
    .order("is_system", { ascending: false })
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as WelcomeDocumentTemplateRow[];
  const legacyTemplates = rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    intro: row.intro,
    sections: parseWelcomeContent(row.content),
    category: row.category,
    isSystem: row.is_system,
  }));
  const sharedTemplates = (await listTemplates("welcome_doc")).map(mapSharedWelcomeTemplate);
  return [...sharedTemplates, ...legacyTemplates];
}

export async function getWelcomeTemplate(
  id: string,
): Promise<WelcomeDocumentTemplate | null> {
  const shared = (await listTemplates("welcome_doc")).find((template) => template.id === id);
  if (shared) return mapSharedWelcomeTemplate(shared);

  const builtin = BUILTIN_WELCOME_TEMPLATES.find((template) => template.id === id);
  if (builtin) return builtin;

  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("welcome_document_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as WelcomeDocumentTemplateRow;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    intro: row.intro,
    sections: parseWelcomeContent(row.content),
    category: row.category,
    isSystem: row.is_system,
  };
}

function mapSharedWelcomeTemplate(template: TemplateRecord): WelcomeDocumentTemplate {
  const content = (template.content ?? {}) as WelcomeDocTemplateContent;
  const sections =
    Array.isArray(content.sections) && content.sections.length > 0
      ? content.sections.map((section, index) => ({
          id: `s_${index + 1}`,
          heading: section.heading || `Section ${index + 1}`,
          body: section.body || "",
        }))
      : [
          {
            id: "s_1",
            heading: "Welcome",
            body: "Add your onboarding details here.",
          },
        ];
  return {
    id: template.id,
    title: template.title,
    description: template.description,
    intro: content.intro ?? null,
    sections,
    category: template.category,
    isSystem: template.isSystem,
  };
}

// ---------------------------------------------------------------------------
// Public-share path
// ---------------------------------------------------------------------------

/**
 * Mint a `public_token` if the row doesn't have one yet. Idempotent —
 * once set, the token is never rotated so any old emailed links keep
 * resolving.
 */
export async function ensureWelcomePublicToken(
  documentId: string,
): Promise<string | null> {
  const admin = getAdminSupabase();
  const { data: existing } = await admin
    .from("welcome_documents")
    .select("public_token")
    .eq("id", documentId)
    .maybeSingle();
  const current =
    (existing as { public_token?: string | null } | null)?.public_token ?? null;
  if (current) return current;
  const token = randomUUID().replace(/-/g, "");
  const { error } = await admin
    .from("welcome_documents")
    .update({ public_token: token } as never)
    .eq("id", documentId);
  if (error) return null;
  return token;
}

export async function getSharedWelcomeDocument(
  token: string,
): Promise<WelcomeDocumentRow | null> {
  if (!isValidWelcomeToken(token)) return null;
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("welcome_documents")
    .select("*")
    .eq("public_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  return data as WelcomeDocumentRow;
}

/**
 * Record a `/w/<token>` visit. De-duped by SHA-256(ip + ua) so the
 * same client refreshing the page doesn't spam the activity feed.
 *
 * Throttled at 1 hour granularity at the document level (mirrors
 * `recordInvoiceView`) to suppress accidental refresh loops.
 */
export async function recordWelcomeView(
  token: string,
  meta: {
    ip: string | null;
    userAgent: string | null;
    viewerUserId?: string | null;
    viewerEmail?: string | null;
  },
): Promise<void> {
  if (!isValidWelcomeToken(token)) return;
  const admin = getAdminSupabase();

  const { data: row } = await admin
    .from("welcome_documents")
    .select("id, user_id, title, viewed_at")
    .eq("public_token", token)
    .maybeSingle();
  if (!row) return;
  const doc = row as {
    id: string;
    user_id: string;
    title: string;
    viewed_at: string | null;
  };

  const fingerprint = createHash("sha256")
    .update(`${meta.ip ?? "no-ip"}|${meta.userAgent ?? "no-ua"}`)
    .digest("hex");

  // Upsert into views — same fingerprint bumps the counter.
  const { data: existing } = await admin
    .from("welcome_document_views")
    .select("id, view_count")
    .eq("document_id", doc.id)
    .eq("fingerprint_hash", fingerprint)
    .maybeSingle();

  if (existing) {
    const e = existing as { id: string; view_count: number };
    await admin
      .from("welcome_document_views")
      .update({
        view_count: e.view_count + 1,
        last_viewed_at: new Date().toISOString(),
        viewer_user_id: meta.viewerUserId ?? null,
        viewer_email: meta.viewerEmail ?? null,
      } as never)
      .eq("id", e.id);
  } else {
    await admin.from("welcome_document_views").insert({
      document_id: doc.id,
      fingerprint_hash: fingerprint,
      user_agent: meta.userAgent,
      viewer_user_id: meta.viewerUserId ?? null,
      viewer_email: meta.viewerEmail ?? null,
    } as never);
  }

  // Throttle the document-level viewed_at + activity event.
  const lastViewedAt = doc.viewed_at ? new Date(doc.viewed_at).getTime() : 0;
  if (Date.now() - lastViewedAt < 60 * 60 * 1000) return;

  await admin
    .from("welcome_documents")
    .update({ viewed_at: new Date().toISOString() } as never)
    .eq("id", doc.id);

  await admin.from("activity_events").insert({
    user_id: doc.user_id,
    kind: "welcome_document_viewed",
    entity_type: "welcome_document",
    entity_id: doc.id,
    title: `Welcome document viewed: ${doc.title}`,
    metadata: { via: "public_link" },
  } as never);

  await admin.from("notifications").insert({
    user_id: doc.user_id,
    type: "welcome_document_viewed",
    title: `Welcome document viewed: ${doc.title}`,
    message: "Your client just opened the onboarding guide.",
  } as never);
}

