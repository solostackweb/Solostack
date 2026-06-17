"use server";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { env } from "@/config/env";
import { isValidPublicShareToken } from "@/features/share/server";
import { getClientIp, publicSignLimit } from "@/lib/rate-limit";
import { dispatchDelivery, pdfAttachment } from "@/features/email/send";
import {
  buildEmailBrand,
  renderContractSignedCopyEmail,
} from "@/features/email/templates";
import { getContractShareUrl } from "@/features/documents/urls";
import type { ContractPdfData } from "@/features/documents/pdf/contract-pdf";
import { captureSignatureMetadata } from "./signature-utils";
import crypto from "crypto";

/**
 * Allowed origin prefix for `signatureImageUrl` posted by anonymous signers.
 *
 * Supabase Storage URLs are predictable in shape:
 *   `<supabaseUrl>/storage/v1/object/<sign|public>/...`
 *
 * Anything outside this prefix is rejected so attackers can't embed
 * external images, tracking pixels, or otherwise sabotage a freshly
 * signed legal document.
 */
const ALLOWED_SIGNATURE_URL_PREFIX = `${env.supabaseUrl}/storage/v1/object/`;
const MAX_SIGNATURE_IMAGE_LENGTH = 200000;
const DATA_URL_SIGNATURE_REGEX = /^data:image\/(png|jpeg|webp);base64,/i;

/**
 * Public signing action for `/c/:token`.
 * Captures comprehensive signature metadata including IP, device info,
 * and legal audit trail for contract signing.
 */
export async function signContractPublicAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const token = String(formData.get("token") ?? "").trim();
  const signatureType = String(formData.get("signatureType") ?? "").trim();
  const signatureImageUrl = String(formData.get("signatureImageUrl") ?? "");
  const signatureTextValue = String(
    formData.get("signatureTextValue") ?? ""
  ).trim();
  const signatureFontFamily = String(
    formData.get("signatureFontFamily") ?? ""
  ).trim();
  const legalName = String(formData.get("legalName") ?? "").trim();

  if (!isValidPublicShareToken(token)) return { ok: false, error: "Invalid token" };
  if (!["draw", "type", "upload"].includes(signatureType)) return { ok: false, error: "Invalid signature type" };
  if (!legalName) return { ok: false, error: "Legal name required" };

  // Hard cap legal name length so a hostile signer can't dump arbitrary
  // content into the contract audit trail.
  if (legalName.length > 200) return { ok: false, error: "Legal name too long" };

  // When the signer uploaded an image, validate it actually came from this
  // app's Supabase storage. Reject `data:`, external URLs, javascript:, etc.
  if (signatureImageUrl) {
    if (signatureImageUrl.length > MAX_SIGNATURE_IMAGE_LENGTH) {
      return { ok: false, error: "Signature image too large" };
    }
    const isSupabaseUrl = signatureImageUrl.startsWith(ALLOWED_SIGNATURE_URL_PREFIX);
    const isDataUrl = DATA_URL_SIGNATURE_REGEX.test(signatureImageUrl);
    if (!isSupabaseUrl && !isDataUrl) {
      return { ok: false, error: "Invalid signature image source" };
    }
  }

  // Per (IP + token) rate-limit to defend against signature replay / spam.
  const ip = await getClientIp();
  const gate = await publicSignLimit(`sign:${ip}:${token}`);
  if (!gate.ok) return { ok: false, error: gate.message };

  const admin = getAdminSupabase();
  const { data: row } = await admin
    .from("contracts")
    .select("id, user_id, client_id, title, status, signed_at, content")
    .eq("public_token", token)
    .maybeSingle();

  if (!row) return { ok: false, error: "Contract not found" };

  const contract = row as {
    id: string;
    user_id: string;
    client_id: string | null;
    title: string;
    status: string;
    signed_at: string | null;
    content: string;
  };

  if (contract.status !== "signed") {
    // Capture comprehensive signature metadata
    const metadata = await captureSignatureMetadata();
    const now = new Date().toISOString();

    // Generate PDF snapshot hash (for immutability proof)
    const pdfSnapshotHash = crypto
      .createHash("sha256")
      .update(contract.content + now + legalName)
      .digest("hex");

    // Create comprehensive audit record
    const signatureRecord = {
      contract_id: contract.id,
      user_id: contract.user_id,
      signature_type: signatureType,
      signature_image_url: signatureImageUrl || null,
      signature_text_value: signatureTextValue || null,
      signature_font_family: signatureFontFamily || null,
      legal_name: legalName,
      signed_ip: metadata.signed_ip,
      signed_user_agent: metadata.signed_user_agent,
      signed_device: metadata.signed_device,
      pdf_snapshot_hash: pdfSnapshotHash,
      metadata: {
        agreement_accepted: true,
        name_confirmed: true,
        signature_method: signatureType,
      },
    };

    // Insert signature audit record
    await admin.from("contract_signatures").insert(signatureRecord as never);

    // Update contract status
    await admin
      .from("contracts")
      .update({
        status: "signed",
        signed_at: now,
        signature_type: signatureType,
        signature_image_url: signatureImageUrl || null,
        signature_text_value: signatureTextValue || null,
        signature_font_family: signatureFontFamily || null,
        signature_metadata: metadata,
        pdf_snapshot_hash: pdfSnapshotHash,
      } as never)
      .eq("id", contract.id);

    // Record activity event
    await admin.from("activity_events").insert({
      user_id: contract.user_id,
      kind: "contract_signed",
      entity_type: "contract",
      entity_id: contract.id,
      title: `"${contract.title}" signed by ${legalName}`,
      metadata: {
        via: "public_link",
        signature_type: signatureType,
        signed_ip: metadata.signed_ip,
        device: metadata.signed_device,
      },
    } as never);

    // Send notification to freelancer
    await admin.from("notifications").insert({
      user_id: contract.user_id,
      type: "contract_signed",
      title: `"${contract.title}" signed`,
      message: `${legalName} has signed the contract.`,
      metadata: {
        contract_id: contract.id,
        signed_ip: metadata.signed_ip,
      },
    } as never);

    // --- Immutable signed-PDF snapshot (best-effort) -----------------------
    // Render the contract exactly as signed and store it in the (private)
    // `contracts` bucket as the legal artifact. The content hash + audit row
    // are already saved above, so a failure here never blocks the signing.
    try {
      const [{ buildContractPdfDataByToken }, { renderPdfToBuffer }, { ContractPdf }] =
        await Promise.all([
          import("@/features/documents/builders"),
          import("@/features/documents/pdf/render"),
          import("@/features/documents/pdf/contract-pdf"),
        ]);
      const pdfData = await buildContractPdfDataByToken(token);
      if (pdfData) {
        const buffer = await renderPdfToBuffer(ContractPdf({ data: pdfData }));
        const bytes = new Uint8Array(buffer);
        // Hash the actual rendered bytes — a stronger immutability proof than
        // hashing the raw text.
        const snapshotHash = crypto.createHash("sha256").update(bytes).digest("hex");
        const path = `${contract.user_id}/signed/${contract.id}_${now.replace(/[:.]/g, "-")}.pdf`;
        const { error: upErr } = await admin.storage
          .from("contracts")
          .upload(path, bytes, { contentType: "application/pdf", upsert: false });
        if (!upErr) {
          await admin
            .from("contracts")
            .update({ pdf_snapshot_url: path, pdf_snapshot_hash: snapshotHash } as never)
            .eq("id", contract.id);
          await admin
            .from("contract_signatures")
            .update({ pdf_snapshot_url: path, pdf_snapshot_hash: snapshotHash } as never)
            .eq("contract_id", contract.id)
            .is("pdf_snapshot_url", null);
        }

        await sendSignedContractCopyToClient({
          admin,
          contract,
          token,
          signedAt: now,
          pdfBuffer: buffer,
          pdfData,
        });
      }
    } catch {
      // Snapshot is an enhancement; the signature + content hash already stand.
    }
  }

  return { ok: true };
}

async function sendSignedContractCopyToClient({
  admin,
  contract,
  token,
  signedAt,
  pdfBuffer,
  pdfData,
}: {
  admin: ReturnType<typeof getAdminSupabase>;
  contract: {
    id: string;
    user_id: string;
    client_id: string | null;
    title: string;
  };
  token: string;
  signedAt: string;
  pdfBuffer: Buffer;
  pdfData: ContractPdfData | null;
}) {
  if (!pdfData || !contract.client_id) return;

  const [{ data: client }, { data: profile }] = await Promise.all([
    admin
      .from("clients")
      .select("email, full_name")
      .eq("id", contract.client_id)
      .maybeSingle(),
    admin
      .from("user_profiles")
      .select(
        "business_name, legal_name, full_name, email, brand_color, business_email, business_phone, website",
      )
      .eq("id", contract.user_id)
      .maybeSingle(),
  ]);

  const c = client as { email?: string | null; full_name?: string | null } | null;
  const toEmail = c?.email?.trim() || null;
  if (!toEmail) return;

  const p = profile as
    | {
        business_name?: string | null;
        legal_name?: string | null;
        full_name?: string | null;
        email?: string | null;
        brand_color?: string | null;
        business_email?: string | null;
        business_phone?: string | null;
        website?: string | null;
      }
    | null;

  const senderName =
    p?.business_name ??
    p?.legal_name ??
    p?.full_name ??
    pdfData.seller.businessName;
  const senderEmail = p?.business_email ?? p?.email ?? pdfData.seller.email ?? undefined;
  const publicUrl = getContractShareUrl(token);
  const rendered = renderContractSignedCopyEmail({
    title: contract.title,
    clientName: c?.full_name ?? pdfData.client.name ?? "there",
    senderName,
    senderEmail,
    signedAt: formatSignedAt(signedAt),
    publicUrl,
    brand: buildEmailBrand({
      businessName: p?.business_name ?? pdfData.seller.businessName,
      legalName: p?.legal_name ?? pdfData.seller.legalName,
      fullName: p?.full_name ?? null,
      brandColor: p?.brand_color ?? pdfData.brandColor,
      logoUrl: pdfData.seller.logoDataUrl,
      businessEmail: p?.business_email ?? pdfData.seller.email,
      businessPhone: p?.business_phone ?? pdfData.seller.phone,
      email: p?.email ?? null,
      website: p?.website ?? null,
    }),
  });

  const slug = contract.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const dispatch = await dispatchDelivery({
    userId: contract.user_id,
    kind: "contract_signed",
    entityType: "contract",
    senderType: "share",
    entityId: contract.id,
    to: { email: toEmail, name: c?.full_name ?? pdfData.client.name ?? undefined },
    replyTo: senderEmail ? { email: senderEmail, name: senderName } : undefined,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    attachments: [
      pdfAttachment(
        `signed-contract-${slug || "contract"}.pdf`,
        pdfBuffer,
      ),
    ],
    metadata: {
      contractId: contract.id,
      signedAt,
      automatic: true,
    },
    tags: ["contract_signed", "share"],
    idempotencyKey: `contract:${contract.id}:signed-copy`,
  });

  await admin.from("activity_events").insert({
    user_id: contract.user_id,
    kind: "contract_signed_copy_sent",
    entity_type: "contract",
    entity_id: contract.id,
    title: dispatch.ok
      ? `Signed copy sent to ${toEmail}`
      : `Signed copy email failed for ${toEmail}`,
    metadata: {
      to: toEmail,
      ok: dispatch.ok,
      log_id: dispatch.logId,
      error: dispatch.ok ? null : dispatch.error,
    },
  } as never);
}

function formatSignedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
