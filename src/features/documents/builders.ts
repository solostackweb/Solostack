import "server-only";

/**
 * View-model builders for PDF templates.
 *
 * Templates are pure render functions; everything DB-shaped is collapsed
 * here so route handlers can call a single `buildInvoicePdfData(id)` and
 * pass the result straight into `<InvoicePdf />`.
 *
 * Public-share variants accept a `token` and bypass the user-scoped
 * lookup so anonymous viewers + outbound emails can still fetch a PDF.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  fetchStorageAsDataUrl,
  normalizeImageForPdf,
} from "@/features/profile/storage";
import type {
  ClientRow,
  ContractRow,
  ContractSignatureRow,
  InvoiceItemRow,
  InvoiceRow,
  ProposalItemRow,
  ProposalRow,
  SubscriptionRow,
  UserProfileRow,
} from "@/lib/supabase/types";
import type { InvoicePdfData } from "./pdf/invoice-pdf";
import type { ContractPdfData } from "./pdf/contract-pdf";
import type { WelcomeDocumentPdfData } from "./pdf/welcome-document-pdf";
import type { ReceiptPdfData } from "./pdf/receipt-pdf";
import { resolveBrand } from "./pdf/brand";
import { getLatestReceiptForInvoice } from "@/features/invoices/receipts";
import type { InvoiceReceiptRow } from "@/lib/supabase/types";
import { hasFeature } from "@/features/subscription/features";
import { getPublicAppUrl } from "./urls";
import { isValidPublicShareToken } from "@/features/share/server";
import {
  isValidWelcomeToken,
} from "@/features/welcome-documents/server";
import { parseWelcomeContent } from "@/features/welcome-documents/content";
import type { WelcomeDocumentRow } from "@/lib/supabase/types";

// --- Authenticated invoice ------------------------------------------------

export async function buildInvoicePdfData(
  invoiceId: string,
): Promise<InvoicePdfData | null> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: invoiceRow }, { data: itemsRows }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("position", { ascending: true }),
  ]);
  if (!invoiceRow) return null;
  const invoice = invoiceRow as unknown as InvoiceRow;

  const [seller, client] = await Promise.all([
    fetchSellerProfile(user.id),
    invoice.client_id ? fetchClient(invoice.client_id) : null,
  ]);
  const customBranding = await userCanCustomizeBranding(user.id, supabase);
  const logoUrl = customBranding
    ? await fetchBrandMarkDataUrl(seller, supabase)
    : null;

  return assembleInvoicePdfData({
    invoice,
    items: (itemsRows as unknown as InvoiceItemRow[]) ?? [],
    seller,
    client,
    logoUrl,
    supabase,
    customBranding,
  });
}

// --- Public token (anonymous + email links) ------------------------------

export async function buildInvoicePdfDataByToken(
  token: string,
): Promise<InvoicePdfData | null> {
  if (!isValidPublicShareToken(token)) return null;
  const admin = getAdminSupabase();
  const { data: invoiceRow } = await admin
    .from("invoices")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  if (!invoiceRow) return null;
  const inv = invoiceRow as unknown as InvoiceRow;

  const [{ data: itemsRows }, seller, client] = await Promise.all([
    admin
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", inv.id)
      .order("position", { ascending: true }),
    fetchSellerProfile(inv.user_id, admin),
    inv.client_id ? fetchClient(inv.client_id, admin) : null,
  ]);
  const customBranding = await userCanCustomizeBranding(inv.user_id, admin);
  const logoUrl = customBranding ? await fetchBrandMarkDataUrl(seller, admin) : null;

  return assembleInvoicePdfData({
    invoice: inv,
    items: (itemsRows as unknown as InvoiceItemRow[]) ?? [],
    seller,
    client,
    logoUrl,
    supabase: admin,
    customBranding,
  });
}

// --- Authenticated contract ----------------------------------------------

export async function buildContractPdfData(
  contractId: string,
): Promise<ContractPdfData | null> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: contractRow } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .eq("user_id", user.id) // defense-in-depth: explicit ownership on top of RLS
    .maybeSingle();
  if (!contractRow) return null;
  const contract = contractRow as unknown as ContractRow;
  const [seller, client] = await Promise.all([
    fetchSellerProfile(user.id),
    contract.client_id ? fetchClient(contract.client_id) : null,
  ]);
  const signature = await fetchLatestContractSignature(contract.id);
  const customBranding = await userCanCustomizeBranding(user.id, supabase);
  const logoUrl = customBranding ? await fetchBrandMarkDataUrl(seller, supabase) : null;
  return assembleContractPdfData({
    contract,
    seller,
    client,
    logoUrl,
    signature,
    supabase,
    customBranding,
  });
}

export async function buildContractPdfDataByToken(
  token: string,
): Promise<ContractPdfData | null> {
  if (!isValidPublicShareToken(token)) return null;
  const admin = getAdminSupabase();
  const { data: row } = await admin
    .from("contracts")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  if (!row) return null;
  const contract = row as unknown as ContractRow;
  const [seller, client, signature] = await Promise.all([
    fetchSellerProfile(contract.user_id, admin),
    contract.client_id ? fetchClient(contract.client_id, admin) : null,
    fetchLatestContractSignature(contract.id, admin),
  ]);
  const customBranding = await userCanCustomizeBranding(contract.user_id, admin);
  const logoUrl = customBranding ? await fetchBrandMarkDataUrl(seller, admin) : null;
  return assembleContractPdfData({
    contract,
    seller,
    client,
    logoUrl,
    signature,
    supabase: admin,
    customBranding,
  });
}

// --- Authenticated proposal ----------------------------------------------

export async function buildProposalPdfData(
  proposalId: string,
): Promise<ContractPdfData | null> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: proposalRow }, { data: itemsRows }] = await Promise.all([
    supabase
      .from("proposals")
      .select("*")
      .eq("id", proposalId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("proposal_items")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("sort_order", { ascending: true }),
  ]);
  if (!proposalRow) return null;
  const proposal = proposalRow as unknown as ProposalRow;

  const [seller, client] = await Promise.all([
    fetchSellerProfile(user.id),
    proposal.client_id ? fetchClient(proposal.client_id) : null,
  ]);
  const customBranding = await userCanCustomizeBranding(user.id, supabase);
  const logoUrl = customBranding ? await fetchBrandMarkDataUrl(seller, supabase) : null;

  return assembleProposalPdfData({
    proposal,
    items: (itemsRows as unknown as ProposalItemRow[]) ?? [],
    seller,
    client,
    logoUrl,
    supabase,
    customBranding,
  });
}

export async function buildProposalPdfDataByToken(
  token: string,
): Promise<ContractPdfData | null> {
  if (!isValidPublicShareToken(token)) return null;
  const admin = getAdminSupabase();
  const { data: proposalRow } = await admin
    .from("proposals")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  if (!proposalRow) return null;
  const proposal = proposalRow as unknown as ProposalRow;
  const { data: itemsRows } = await admin
    .from("proposal_items")
    .select("*")
    .eq("proposal_id", proposal.id)
    .order("sort_order", { ascending: true });
  const [seller, client] = await Promise.all([
    fetchSellerProfile(proposal.user_id, admin),
    proposal.client_id ? fetchClient(proposal.client_id, admin) : null,
  ]);
  const customBranding = await userCanCustomizeBranding(proposal.user_id, admin);
  const logoUrl = customBranding ? await fetchBrandMarkDataUrl(seller, admin) : null;

  return assembleProposalPdfData({
    proposal,
    items: (itemsRows as unknown as ProposalItemRow[]) ?? [],
    seller,
    client,
    logoUrl,
    supabase: admin,
    customBranding,
  });
}

// --- Internal: fetchers ---------------------------------------------------

type AnySupabase = Awaited<ReturnType<typeof getServerSupabase>>;

async function fetchSellerProfile(
  userId: string,
  client?: AnySupabase,
): Promise<UserProfileRow | null> {
  const sb = client ?? (await getServerSupabase());
  const { data } = await sb
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return (data as unknown as UserProfileRow | null) ?? null;
}

async function fetchClient(
  clientId: string,
  client?: AnySupabase,
): Promise<ClientRow | null> {
  const sb = client ?? (await getServerSupabase());
  const { data } = await sb
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();
  return (data as unknown as ClientRow | null) ?? null;
}

async function fetchLatestContractSignature(
  contractId: string,
  client?: AnySupabase,
): Promise<ContractSignatureRow | null> {
  const sb = client ?? (await getServerSupabase());
  const { data } = await sb
    .from("contract_signatures")
    .select("*")
    .eq("contract_id", contractId)
    .order("signed_at", { ascending: false })
    .limit(1);
  return ((data?.[0] as unknown as ContractSignatureRow | undefined) ?? null);
}

async function fetchBrandMarkDataUrl(
  seller: UserProfileRow | null,
  client: AnySupabase,
): Promise<string | null> {
  const logo = await fetchStorageAsDataUrl(
    "branding-assets",
    seller?.logo_url,
    client,
  );
  if (logo) return logo;
  return fetchStorageAsDataUrl("branding-assets", seller?.brand_icon_url, client);
}

async function userCanCustomizeBranding(
  userId: string,
  client: AnySupabase,
): Promise<boolean> {
  const { data } = await client
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const row = (data as unknown as SubscriptionRow | null) ?? null;
  return hasFeature(
    row
      ? {
          userId: row.user_id,
          plan: row.plan,
          status: row.status,
          trialEndsAt: row.trial_ends_at,
          currentPeriodEnd: row.current_period_end,
          razorpaySubscriptionId: row.razorpay_subscription_id,
        }
      : null,
    "invoices.custom_branding",
  );
}

function withoutCustomBranding(
  seller: UserProfileRow | null,
): UserProfileRow | null {
  if (!seller) return null;
  return {
    ...seller,
    brand_color: null,
    brand_tagline: null,
    logo_url: null,
    brand_icon_url: null,
  };
}

// --- Internal: assemblers -------------------------------------------------

async function assembleInvoicePdfData(args: {
  invoice: InvoiceRow;
  items: InvoiceItemRow[];
  seller: UserProfileRow | null;
  client: ClientRow | null;
  logoUrl: string | null;
  supabase: AnySupabase;
  customBranding: boolean;
}): Promise<InvoicePdfData> {
  const { invoice, items, seller, client, logoUrl, supabase, customBranding } = args;
  const sellerSignatureImage = seller?.signature_image_url
    ? await normalizeImageForPdf(
        seller.signature_image_url,
        "profile-images",
        supabase,
      )
    : null;
  const publicUrl = invoice.public_token
    ? `${getPublicAppUrl()}/i/${invoice.public_token}`
    : null;
  return {
    invoiceNumber: invoice.invoice_number,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    currency: invoice.currency,
    isExport: (invoice as { is_export?: boolean | null }).is_export ?? false,
    fxRate:
      Number((invoice as { fx_rate_to_inr?: number | string | null }).fx_rate_to_inr) || null,
    inrEquivalent:
      (invoice as { inr_equivalent?: number | string | null }).inr_equivalent == null
        ? null
        : Number((invoice as { inr_equivalent?: number | string | null }).inr_equivalent),
    status: invoice.status,
    paymentStatus: invoice.payment_status,
    paidAt: invoice.paid_at,
    paymentMethod: invoice.payment_method,
    paymentReference: invoice.payment_reference,
    paymentAmount:
      invoice.payment_amount === null ? null : Number(invoice.payment_amount),
    paymentRecordedAt: invoice.payment_recorded_at,
    taxMode: invoice.tax_mode,
    classification: invoice.classification,
    subtotal: Number(invoice.subtotal) || 0,
    discount: Number(invoice.discount_amount) || 0,
    cgstAmount: Number(invoice.cgst_amount) || 0,
    sgstAmount: Number(invoice.sgst_amount) || 0,
    igstAmount: Number(invoice.igst_amount) || 0,
    taxTotal: Number(invoice.gst_amount) || 0,
    totalAmount: Number(invoice.total_amount) || 0,
    notes: invoice.notes,
    terms: invoice.terms,
    footerNote: invoice.footer_note,
    hsnSac: invoice.hsn_sac,
    paymentLink: invoice.payment_link,
    publicUrl,
    brandColor: customBranding ? (seller?.brand_color ?? null) : null,
    items: items.map((it) => ({
      description: it.description,
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unit_price) || 0,
      gstRate: Number(it.gst_rate) || 0,
      amount: Number(it.amount) || 0,
    })),
    seller: {
      businessName:
        seller?.business_name ??
        seller?.company_name ??
        seller?.legal_name ??
        seller?.full_name ??
        "Your Business",
      legalName: seller?.legal_name ?? null,
      email: seller?.business_email ?? seller?.email ?? null,
      phone: seller?.business_phone ?? seller?.phone ?? null,
      gstin: seller?.gstin ?? seller?.gst_number ?? null,
      gstRegistered:
        (seller as { gst_registered?: boolean | null } | null)?.gst_registered ?? false,
      lutNumber:
        (seller as { lut_number?: string | null } | null)?.lut_number ?? null,
      pan: seller?.pan ?? null,
      addressLines: composeAddress(
        seller?.address_line1,
        seller?.address_line2,
        seller?.city,
        seller?.postal_code,
        seller?.country,
      ),
      stateCode: seller?.state_code ?? null,
      logoDataUrl: logoUrl,
      website: seller?.website ?? null,
      signature: seller?.signature_type
        ? {
            type: seller.signature_type,
            imageUrl: sellerSignatureImage,
            textValue: seller.signature_text_value,
            fontFamily: seller.signature_font_family,
            legalName:
              seller.legal_name ??
              seller.business_name ??
              seller.full_name ??
              null,
            signedAt: seller.signature_updated_at ?? null,
          }
        : null,
    },
    client: {
      name: client?.full_name ?? "Client",
      email: client?.email ?? null,
      phone: client?.phone ?? null,
      companyName: client?.business_name ?? client?.company_name ?? null,
      gstin: client?.gst_number ?? null,
      stateCode: client?.state_code ?? null,
      country: (client as { country?: string | null } | null)?.country ?? null,
      addressLines: composeAddress(client?.billing_address ?? client?.address),
    },
  };
}

async function assembleContractPdfData(args: {
  contract: ContractRow;
  seller: UserProfileRow | null;
  client: ClientRow | null;
  logoUrl: string | null;
  signature: ContractSignatureRow | null;
  supabase: AnySupabase;
  customBranding?: boolean;
}): Promise<ContractPdfData> {
  const { contract, seller, client, logoUrl, signature, supabase, customBranding } = args;
  // Resolve every signature image up-front. The DB column may hold a
  // data: URL, a Supabase storage path, or a fully-qualified https URL.
  // normalizeImageForPdf collapses all three into a base64 data URL the
  // PDF renderer can embed without a network round-trip.
  const [
    clientContractSignatureImage,
    contractInlineSignatureImage,
    sellerSignatureImage,
  ] = await Promise.all([
    signature?.signature_image_url
      ? normalizeImageForPdf(
          signature.signature_image_url,
          "profile-images",
          supabase,
        )
      : null,
    contract.signature_image_url
      ? normalizeImageForPdf(
          contract.signature_image_url,
          "profile-images",
          supabase,
        )
      : null,
    seller?.signature_image_url
      ? normalizeImageForPdf(
          seller.signature_image_url,
          "profile-images",
          supabase,
        )
      : null,
  ]);
  const publicUrl = contract.public_token
    ? `${getPublicAppUrl()}/c/${contract.public_token}`
    : null;
  return {
    kind: contract.kind,
    title: contract.title,
    content: contract.content ?? "",
    status: contract.status,
    currency: contract.currency,
    valueAmount:
      contract.value_amount === null ? null : Number(contract.value_amount),
    issuedAt: contract.created_at,
    expiresAt: contract.expires_at,
    signedAt: contract.signed_at,
    signerName: signature?.legal_name ?? client?.full_name ?? null,
    signerEmail: client?.email ?? null,
    clientSignature: signature
      ? {
          type: signature.signature_type,
          imageUrl: clientContractSignatureImage,
          textValue: signature.signature_text_value,
          fontFamily: signature.signature_font_family,
          legalName: signature.legal_name,
          signedAt: signature.signed_at,
          signerEmail: client?.email ?? null,
          signedIp: signature.signed_ip,
          signedUserAgent: signature.signed_user_agent ?? null,
          snapshotHash: signature.pdf_snapshot_hash ?? contract.pdf_snapshot_hash ?? null,
        }
      : contract.signature_type
        ? {
            type: contract.signature_type,
            imageUrl: contractInlineSignatureImage,
            textValue: contract.signature_text_value,
            fontFamily: contract.signature_font_family,
            legalName: client?.full_name ?? null,
            signedAt: contract.signed_at,
            signerEmail: client?.email ?? null,
            signedIp: null,
            signedUserAgent: null,
            snapshotHash: contract.pdf_snapshot_hash ?? null,
          }
        : null,
    publicUrl,
    brandColor: customBranding ? (seller?.brand_color ?? null) : null,
    seller: {
      businessName:
        seller?.business_name ??
        seller?.company_name ??
        seller?.legal_name ??
        seller?.full_name ??
        "Your Business",
      legalName: seller?.legal_name ?? null,
      email: seller?.business_email ?? seller?.email ?? null,
      phone: seller?.business_phone ?? seller?.phone ?? null,
      addressLines: composeAddress(
        seller?.address_line1,
        seller?.address_line2,
        seller?.city,
        seller?.postal_code,
        seller?.country,
      ),
      logoDataUrl: logoUrl,
      signature: seller?.signature_type
        ? {
            type: seller.signature_type,
            imageUrl: sellerSignatureImage,
            textValue: seller.signature_text_value,
            fontFamily: seller.signature_font_family,
            legalName:
              seller.legal_name ??
              seller.business_name ??
              seller.full_name ??
              null,
            signedAt: seller.signature_updated_at ?? contract.created_at,
          }
        : null,
    },
    client: {
      name: client?.full_name ?? "Client",
      detailLines: composeAddress(
        client?.email,
        client?.billing_address ?? client?.address,
        client?.phone,
        client?.business_name ?? client?.company_name,
      ),
    },
  };
}

async function assembleProposalPdfData(args: {
  proposal: ProposalRow;
  items: ProposalItemRow[];
  seller: UserProfileRow | null;
  client: ClientRow | null;
  logoUrl: string | null;
  supabase: AnySupabase;
  customBranding?: boolean;
}): Promise<ContractPdfData> {
  const { proposal, items, seller, client, logoUrl, supabase, customBranding } = args;
  const sellerSignatureImage = seller?.signature_image_url
    ? await normalizeImageForPdf(
        seller.signature_image_url,
        "profile-images",
        supabase,
      )
    : null;
  const publicUrl = proposal.public_token
    ? `${getPublicAppUrl()}/p/${proposal.public_token}`
    : null;

  return {
    kind: "proposal",
    title: proposal.title,
    content: buildProposalPdfContent(proposal, items),
    status: proposal.status,
    currency: proposal.currency,
    valueAmount: Number(proposal.total_amount) || null,
    issuedAt: proposal.created_at,
    expiresAt: proposal.valid_until,
    signedAt: proposal.accepted_at,
    signerName: client?.full_name ?? null,
    signerEmail: client?.email ?? null,
    clientSignature: null,
    publicUrl,
    brandColor: customBranding ? (seller?.brand_color ?? null) : null,
    seller: {
      businessName:
        seller?.business_name ??
        seller?.company_name ??
        seller?.legal_name ??
        seller?.full_name ??
        "Your Business",
      legalName: seller?.legal_name ?? null,
      email: seller?.business_email ?? seller?.email ?? null,
      phone: seller?.business_phone ?? seller?.phone ?? null,
      addressLines: composeAddress(
        seller?.address_line1,
        seller?.address_line2,
        seller?.city,
        seller?.postal_code,
        seller?.country,
      ),
      logoDataUrl: logoUrl,
      signature: seller?.signature_type
        ? {
            type: seller.signature_type,
            imageUrl: sellerSignatureImage,
            textValue: seller.signature_text_value,
            fontFamily: seller.signature_font_family,
            legalName:
              seller.legal_name ??
              seller.business_name ??
              seller.full_name ??
              null,
            signedAt: seller.signature_updated_at ?? proposal.created_at,
          }
        : null,
    },
    client: {
      name: client?.business_name ?? client?.full_name ?? "Client",
      detailLines: composeAddress(
        client?.email,
        client?.billing_address ?? client?.address,
        client?.phone,
        client?.business_name ?? client?.company_name,
      ),
    },
  };
}

function buildProposalPdfContent(
  proposal: ProposalRow,
  items: ProposalItemRow[],
): string {
  const pricingLines =
    items.length > 0
      ? items
          .map((item) => {
            const qty = Number(item.quantity) || 0;
            const unit = formatPdfAmount(Number(item.unit_price) || 0, proposal.currency);
            const amount = formatPdfAmount(Number(item.amount) || 0, proposal.currency);
            return `${item.description} - Qty ${qty} x ${unit} = ${amount}`;
          })
          .join("\n")
      : "Pricing will be confirmed in writing.";

  const sections = [
    { heading: "Scope", body: proposal.scope?.trim() || "Scope will be confirmed in writing." },
    {
      heading: "Deliverables",
      body: proposal.deliverables?.trim() || "Deliverables will be confirmed in writing.",
    },
    {
      heading: "Timeline",
      body: proposal.timeline?.trim() || "Timeline will be mutually confirmed.",
    },
    {
      heading: "Packages and pricing",
      body: [
        pricingLines,
        "",
        `Subtotal: ${formatPdfAmount(Number(proposal.subtotal) || 0, proposal.currency)}`,
        `Tax / charges: ${formatPdfAmount(Number(proposal.tax_amount) || 0, proposal.currency)}`,
        `Total: ${formatPdfAmount(Number(proposal.total_amount) || 0, proposal.currency)}`,
      ].join("\n"),
    },
    {
      heading: "Terms",
      body: proposal.terms?.trim() || "Commercial terms will be confirmed in writing.",
    },
  ];

  return JSON.stringify(sections);
}

function formatPdfAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function composeAddress(...parts: Array<string | null | undefined>): string[] {
  return parts.filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0,
  );
}

// --- Authenticated welcome document --------------------------------------

export async function buildWelcomeDocumentPdfData(
  documentId: string,
): Promise<WelcomeDocumentPdfData | null> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: row } = await supabase
    .from("welcome_documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return null;
  const doc = row as WelcomeDocumentRow;
  const [seller, client] = await Promise.all([
    fetchSellerProfile(user.id),
    doc.client_id ? fetchClient(doc.client_id) : null,
  ]);
  const canBrand = await userCanCustomizeBranding(user.id, supabase);
  const logoUrl = canBrand ? await fetchBrandMarkDataUrl(seller, supabase) : null;
  return assembleWelcomePdfData({ doc, seller, client, logoUrl });
}

export async function buildWelcomeDocumentPdfDataByToken(
  token: string,
): Promise<WelcomeDocumentPdfData | null> {
  if (!isValidWelcomeToken(token)) return null;
  const admin = getAdminSupabase();
  const { data: row } = await admin
    .from("welcome_documents")
    .select("*")
    .eq("public_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row) return null;
  const doc = row as WelcomeDocumentRow;
  const [seller, client] = await Promise.all([
    fetchSellerProfile(doc.user_id, admin),
    doc.client_id ? fetchClient(doc.client_id, admin) : null,
  ]);
  const canBrand = await userCanCustomizeBranding(doc.user_id, admin);
  const logoUrl = canBrand ? await fetchBrandMarkDataUrl(seller, admin) : null;
  return assembleWelcomePdfData({ doc, seller, client, logoUrl });
}

function assembleWelcomePdfData(args: {
  doc: WelcomeDocumentRow;
  seller: UserProfileRow | null;
  client: ClientRow | null;
  logoUrl: string | null;
}): WelcomeDocumentPdfData {
  const { doc, seller, client, logoUrl } = args;
  return {
    title: doc.title,
    intro: doc.intro,
    sections: parseWelcomeContent(doc.content),
    brandColor: doc.brand_color ?? seller?.brand_color ?? null,
    publishedAt: doc.published_at ?? doc.created_at,
    publicUrl: doc.public_token
      ? `${getPublicAppUrl()}/w/${doc.public_token}`
      : null,
    acknowledgementRequired: doc.acknowledgement_required,
    seller: {
      businessName:
        seller?.business_name ??
        seller?.company_name ??
        seller?.legal_name ??
        seller?.full_name ??
        "Your Business",
      legalName: seller?.legal_name ?? null,
      email: seller?.business_email ?? seller?.email ?? null,
      phone: seller?.business_phone ?? seller?.phone ?? null,
      addressLines: composeAddress(
        seller?.address_line1,
        seller?.address_line2,
        seller?.city,
        seller?.postal_code,
        seller?.country,
      ),
      logoDataUrl: logoUrl,
      website: seller?.website ?? null,
    },
    recipient: client
      ? {
          name: client.full_name ?? null,
          company: client.business_name ?? client.company_name ?? null,
          email: client.email ?? null,
        }
      : null,
  };
}

// --- Receipts (authenticated + public) -----------------------------------
//
// The receipt is generated AFTER a successful payment. When neither flow
// has run yet we return null and the route layer 404s.

async function assembleReceiptPdfData(args: {
  receipt: InvoiceReceiptRow;
  invoice: InvoiceRow;
  seller: UserProfileRow | null;
  client: ClientRow | null;
  logoUrl: string | null;
  customBranding: boolean;
}): Promise<ReceiptPdfData> {
  const { receipt, invoice, seller, client, logoUrl, customBranding } = args;
  const brand = resolveBrand(
    customBranding ? seller : withoutCustomBranding(seller),
    logoUrl,
  );
  return {
    receiptNumber: receipt.receipt_number,
    invoiceNumber: invoice.invoice_number,
    paidAt: receipt.paid_at,
    paymentMethod: receipt.payment_method,
    reference: receipt.reference,
    amount: Number(receipt.amount) || 0,
    currency: receipt.currency || invoice.currency || "INR",
    notes: receipt.notes,
    brand,
    client: {
      name: client?.full_name ?? receipt.payer_name ?? "Client",
      companyName: client?.business_name ?? client?.company_name ?? null,
      email: client?.email ?? receipt.payer_email ?? null,
      addressLines: composeAddress(client?.billing_address ?? client?.address),
      gstin: client?.gst_number ?? null,
    },
  };
}

export async function buildReceiptPdfData(
  invoiceId: string,
): Promise<ReceiptPdfData | null> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: invoiceRow } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!invoiceRow) return null;
  const invoice = invoiceRow as unknown as InvoiceRow;
  const receipt = await getLatestReceiptForInvoice(invoice.id);
  if (!receipt) return null;
  const [seller, client] = await Promise.all([
    fetchSellerProfile(invoice.user_id),
    invoice.client_id ? fetchClient(invoice.client_id) : null,
  ]);
  const customBranding = await userCanCustomizeBranding(invoice.user_id, supabase);
  const logoUrl = customBranding
    ? await fetchBrandMarkDataUrl(seller, supabase)
    : null;
  return assembleReceiptPdfData({
    receipt,
    invoice,
    seller,
    client,
    logoUrl,
    customBranding,
  });
}

export async function buildReceiptPdfDataByToken(
  token: string,
): Promise<ReceiptPdfData | null> {
  if (!isValidPublicShareToken(token)) return null;
  const admin = getAdminSupabase();
  const { data: invoiceRow } = await admin
    .from("invoices")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  if (!invoiceRow) return null;
  const invoice = invoiceRow as unknown as InvoiceRow;
  const receipt = await getLatestReceiptForInvoice(invoice.id);
  if (!receipt) return null;
  const [seller, client] = await Promise.all([
    fetchSellerProfile(invoice.user_id, admin),
    invoice.client_id ? fetchClient(invoice.client_id, admin) : null,
  ]);
  const customBranding = await userCanCustomizeBranding(invoice.user_id, admin);
  const logoUrl = customBranding ? await fetchBrandMarkDataUrl(seller, admin) : null;
  return assembleReceiptPdfData({
    receipt,
    invoice,
    seller,
    client,
    logoUrl,
    customBranding,
  });
}
