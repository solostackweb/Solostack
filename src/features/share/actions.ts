"use server";

/**
 * Share-related server actions.
 *
 * These are thin wrappers that authenticate the caller (must be the
 * invoice/contract owner) before minting a public share token.
 */

import { z } from "zod";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import {
  ensureInvoicePublicToken,
  ensureContractPublicToken,
} from "./server";

type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

async function requireUserId(): Promise<string> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user.id;
}

// ---------------------------------------------------------------------------
// Invoice public token
// ---------------------------------------------------------------------------

const invoiceTokenSchema = z.object({ invoiceId: z.string().uuid() });

export async function ensureInvoicePublicTokenAction(
  input: z.input<typeof invoiceTokenSchema>,
): Promise<ActionResult<{ token: string }>> {
  const parsed = invoiceTokenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const userId = await requireUserId();
  const token = await ensureInvoicePublicToken(parsed.data.invoiceId);
  if (!token) return { ok: false, error: "Could not create share link." };

  // Sharing the public link is an explicit "send to client" action, so a
  // draft becomes issued ('sent'). This keeps invoices that are delivered via
  // link / WhatsApp (instead of email) from being stuck on draft — which made
  // their PDF show DRAFT. Never touch non-draft invoices.
  try {
    const supabase = await getServerSupabase();
    await supabase
      .from("invoices")
      .update({ status: "sent", sent_at: new Date().toISOString() } as never)
      .eq("id", parsed.data.invoiceId)
      .eq("user_id", userId)
      .eq("status", "draft");
  } catch {
    // Best-effort — the share link still works even if the status flip fails.
  }

  return { ok: true, data: { token } };
}

// ---------------------------------------------------------------------------
// Contract public token (convenience re-export as a share action)
// ---------------------------------------------------------------------------

const contractTokenSchema = z.object({ contractId: z.string().uuid() });

export async function ensureContractPublicTokenAction(
  input: z.input<typeof contractTokenSchema>,
): Promise<ActionResult<{ token: string }>> {
  const parsed = contractTokenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  await requireUserId();
  const token = await ensureContractPublicToken(parsed.data.contractId);
  if (!token) return { ok: false, error: "Could not create share link." };
  return { ok: true, data: { token } };
}
