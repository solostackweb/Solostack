import "server-only";

/**
 * Model-backed draft generation for Ivo's create workflows.
 *
 * These were `"use server"` form actions, which made them public endpoints and
 * forced every caller to round-trip a plain object through `FormData` just to
 * have it JSON-parsed straight back out. The only callers now live in
 * `domain-operations.ts`, so they are plain server functions taking typed
 * input. They still authenticate and rate-limit, because they spend model
 * budget on the caller's behalf.
 *
 * Do not add `"use server"` to this file.
 */

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { listClients } from "@/features/clients/server";
import { listProjects } from "@/features/projects/server";
import { getProfile } from "@/features/profile/server";
import { aiInvoiceRequestSchema, type AiWorkflowResult, type AiInvoiceDraft } from "./types";
import { draftInvoiceWithAi } from "./invoice-workflow";
import {
  draftOperationalWorkflow,
  type OperationsDraft,
  type OperationsWorkflow,
} from "./operations-workflow";
import { z } from "zod";
import { aiGenerateLimit } from "@/lib/rate-limit";

async function requireUser() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user;
}

export async function generateInvoiceDraft(
  input: z.input<typeof aiInvoiceRequestSchema>,
): Promise<AiWorkflowResult<AiInvoiceDraft>> {
  const user = await requireUser();
  const rl = await aiGenerateLimit(`aigen:${user.id}`);
  if (!rl.ok) return { ok: false, error: rl.message };

  const parsed = aiInvoiceRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please complete the invoice workflow fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const [clients, projects, profile] = await Promise.all([
    listClients({ limit: 200 }),
    listProjects({ limit: 200 }),
    getProfile(),
  ]);

  const client = clients.find((item) => item.id === parsed.data.clientId);
  if (!client) {
    return { ok: false, error: "Choose a client you have access to." };
  }

  const project = parsed.data.projectId
    ? projects.find(
        (item) => item.id === parsed.data.projectId && item.clientId === client.id,
      ) ?? null
    : null;

  try {
    const result = await draftInvoiceWithAi({
      input: parsed.data,
      client,
      project,
      defaultTerms: profile?.invoiceDefaultTerms,
    });
    return { ok: true, data: result.draft, provider: result.provider };
  } catch {
    return {
      ok: false,
      error: "AI draft generation is temporarily unavailable. Try again shortly.",
    };
  }
}

const operationalDraftRequestSchema = z.object({
  workflow: z.enum([
    "client",
    "project",
    "portal",
    "time_entry",
    "contract",
    "welcome_document",
  ]),
  prompt: z.string().trim().min(4).max(6000),
  clientId: z.string().optional().or(z.literal("")),
  projectId: z.string().optional().or(z.literal("")),
  defaultHourlyRate: z.coerce.number().nonnegative().optional(),
});

export async function generateOperationalDraft(
  input: z.input<typeof operationalDraftRequestSchema>,
): Promise<AiWorkflowResult<OperationsDraft>> {
  const user = await requireUser();
  const rl = await aiGenerateLimit(`aigen:${user.id}`);
  if (!rl.ok) return { ok: false, error: rl.message };
  const parsed = operationalDraftRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Describe what you want Stackivo AI to draft.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const [clients, projects] = await Promise.all([
    listClients({ limit: 200 }),
    listProjects({ limit: 200 }),
  ]);

  const clientId = parsed.data.clientId || undefined;
  const projectId = parsed.data.projectId || undefined;
  if (clientId && !clients.some((client) => client.id === clientId)) {
    return { ok: false, error: "Choose a client you have access to." };
  }
  if (projectId && !projects.some((project) => project.id === projectId)) {
    return { ok: false, error: "Choose a project you have access to." };
  }

  const result = await draftOperationalWorkflow(
    parsed.data.workflow as OperationsWorkflow,
    {
      prompt: parsed.data.prompt,
      clientId,
      projectId,
      clients,
      projects,
      defaultHourlyRate: parsed.data.defaultHourlyRate,
    },
  );

  return { ok: true, data: result.draft, provider: result.provider };
}
