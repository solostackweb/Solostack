import "server-only";

/**
 * Contract / Proposal PDF — redesigned to match the invoice PDF quality.
 *
 * Layout (same discipline as invoice-pdf.tsx):
 *   1. Brand accent bar  — full-width, top of page
 *   2. Header            — logo + business name/contact left │ eyebrow + title + badge right
 *   3. Meta row          — Issued │ Expires │ Value
 *   4. Parties           — Between left │ And right  (vertical divider, no box cards)
 *   5. Body              — numbered sections or paragraphs
 *   6. Signature pair    — both seller + client (empty placeholder for proposals)
 *   7. Fixed footer
 *
 * Key fixes vs old version:
 *   - Title font reduced from 24pt → 18pt so long titles never wrap mid-word
 *   - Accent bar via negative margins (same trick as invoice PDF)
 *   - Spacing tightened so 5-6 section proposals stay on one page
 *   - Parties rendered as clean columns with divider, not bordered box cards
 *   - Signature pair always renders (empty lines for proposals, filled for contracts)
 *   - Uses Page directly — no DocumentPage wrapper fighting with layout
 */

import * as React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { parseContractContent } from "@/features/contracts/content";
import {
  hasSignatureReference,
  type ContractSignatureType,
  type ContractSignatureReference,
} from "@/features/contracts/signatures";
import {
  pdfColors,
  pdfFonts,
  pdfLineHeights,
  pdfRadii,
  pdfSizes,
  pdfSpacing,
  pdfTracking,
} from "./theme";
import { resolveBrand, type ResolvedBrand } from "./brand";
import {
  Badge,
  DocumentFooter,
  SignatureBlock,
  formatCurrency,
  formatDate,
  type BadgeTone,
  type SignatureData,
} from "./primitives";
import type { UserProfileRow } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Data shapes (contract preserved exactly — no breaking changes)
// ---------------------------------------------------------------------------

export interface ContractPdfParty {
  name: string;
  detailLines: string[];
}

export interface ContractPdfData {
  kind: "contract" | "proposal";
  title: string;
  content: string;
  status: string;
  currency: string;
  valueAmount: number | null;
  issuedAt: string;
  expiresAt: string | null;
  signedAt: string | null;
  signerName: string | null;
  signerEmail: string | null;
  clientSignature:
    | (ContractSignatureReference & {
        legalName: string | null;
        signedAt: string | null;
        signerEmail: string | null;
        signedIp: string | null;
      })
    | null;
  publicUrl: string | null;
  brandColor: string | null;
  seller: {
    businessName: string;
    legalName: string | null;
    email: string | null;
    phone: string | null;
    addressLines: string[];
    logoDataUrl: string | null;
    signature:
      | (ContractSignatureReference & {
          legalName: string | null;
          signedAt: string | null;
        })
      | null;
  };
  client: ContractPdfParty;
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const PAD = pdfSpacing.pagePadding; // 40

const s = StyleSheet.create({
  page: {
    fontFamily: pdfFonts.base,
    fontSize: pdfSizes.base,
    color: pdfColors.foreground,
    backgroundColor: pdfColors.surface,
    paddingHorizontal: PAD,
    paddingTop: PAD,
    paddingBottom: PAD + 28, // room for fixed footer
    // NOTE: never set lineHeight on the Page style — react-pdf stops
    // rendering fixed/absolute children (the footer) when it is present.
  },

  // ── accent bar (full-bleed via negative margins) ─────────────────────────
  accentBar: {
    height: 4,
    marginHorizontal: -PAD,
    marginTop: -PAD,
    marginBottom: 18,
  },

  // ── shared row separator ──────────────────────────────────────────────────
  sep: {
    borderBottomWidth: 0.5,
    borderBottomColor: pdfColors.border,
    marginBottom: 14,
    paddingBottom: 14,
  },

  // ── header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    maxWidth: "55%",
  },
  logo: {
    width: 40,
    height: 40,
    objectFit: "contain",
    marginRight: 10,
    borderRadius: pdfRadii.sm,
  },
  businessName: {
    fontFamily: pdfFonts.bold,
    fontSize: pdfSizes.md,
    color: pdfColors.foreground,
    lineHeight: pdfLineHeights.tight,
    marginBottom: 3,
  },
  headerLine: {
    fontSize: pdfSizes.xs,
    color: pdfColors.mutedForeground,
    marginTop: 2,
  },
  headerRight: {
    alignItems: "flex-end",
    maxWidth: "48%",
  },
  docEyebrow: {
    fontFamily: pdfFonts.bold,
    fontSize: pdfSizes.eyebrow,
    textTransform: "uppercase",
    letterSpacing: pdfTracking.wider,
    marginBottom: 5,
  },
  // 18pt instead of 24pt — prevents long titles from wrapping mid-word
  docTitle: {
    fontFamily: pdfFonts.bold,
    fontSize: pdfSizes.xl,
    color: pdfColors.foreground,
    letterSpacing: pdfTracking.tight,
    lineHeight: pdfLineHeights.tight,
    textAlign: "right",
    marginBottom: 6,
  },
  docSubtitle: {
    fontSize: pdfSizes.sm,
    color: pdfColors.mutedForeground,
    textAlign: "right",
    marginBottom: 6,
  },

  // ── meta row ──────────────────────────────────────────────────────────────
  metaRow: {
    flexDirection: "row",
  },
  metaCell: {
    flex: 1,
  },
  metaLabel: {
    fontFamily: pdfFonts.bold,
    fontSize: pdfSizes.eyebrow,
    color: pdfColors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: pdfTracking.wider,
    marginBottom: 3,
  },
  metaValue: {
    fontFamily: pdfFonts.bold,
    fontSize: pdfSizes.sm,
    color: pdfColors.foreground,
  },

  // ── parties (columns with divider, no box cards) ──────────────────────────
  parties: {
    flexDirection: "row",
  },
  partyCol: {
    flex: 1,
  },
  partyColRight: {
    flex: 1,
    paddingLeft: 20,
    borderLeftWidth: 0.5,
    borderLeftColor: pdfColors.border,
    marginLeft: 20,
  },
  partyEyebrow: {
    fontFamily: pdfFonts.bold,
    fontSize: pdfSizes.eyebrow,
    color: pdfColors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: pdfTracking.wider,
    marginBottom: 6,
  },
  partyName: {
    fontFamily: pdfFonts.bold,
    fontSize: pdfSizes.sm,
    color: pdfColors.foreground,
    marginBottom: 4,
  },
  partyLine: {
    fontSize: pdfSizes.xs,
    color: pdfColors.mutedForeground,
    marginTop: 2,
    lineHeight: pdfLineHeights.snug,
  },

  // ── body sections ─────────────────────────────────────────────────────────
  section: {
    marginBottom: 14,
  },
  numberRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  sectionNumber: {
    fontFamily: pdfFonts.bold,
    fontSize: pdfSizes.eyebrow,
    color: pdfColors.mutedForeground,
    letterSpacing: pdfTracking.wider,
    marginRight: 8,
    minWidth: 22,
  },
  sectionHeading: {
    fontFamily: pdfFonts.bold,
    fontSize: pdfSizes.md,
    color: pdfColors.foreground,
    letterSpacing: pdfTracking.tight,
  },
  sectionBody: {
    fontSize: pdfSizes.sm,
    color: pdfColors.text,
    lineHeight: pdfLineHeights.relaxed,
    marginTop: 4,
  },

  // ── signature pair ────────────────────────────────────────────────────────
  signaturePair: {
    flexDirection: "row",
    marginTop: pdfSpacing["2xl"],
    justifyContent: "space-between",
  },
  signatureSpacer: { width: pdfSpacing.lg },
  signatureSlot: { flex: 1 },
});

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export function ContractPdf({
  data,
  seller,
  logoDataUrl,
}: {
  data: ContractPdfData;
  seller?: UserProfileRow | null;
  logoDataUrl?: string | null;
}) {
  const brand = buildBrandFromData(data, seller, logoDataUrl);
  const isContract = data.kind === "contract";
  const eyebrow = isContract ? "CONTRACT" : "PROPOSAL";
  const parsedContent = parseContractContent(data.content);

  const statusTone: BadgeTone =
    data.status === "signed" || data.status === "accepted"
      ? "success"
      : data.status === "declined"
        ? "danger"
        : data.status === "expired"
          ? "warning"
          : "brand";

  const statusLabel = data.status.replace(/_/g, " ");

  return (
    <Document title={`${eyebrow} – ${data.title}`} author={brand.businessName}>
      <Page size="A4" style={s.page}>

        {/* ── 1. ACCENT BAR ─────────────────────────────────── */}
        <View style={[s.accentBar, { backgroundColor: brand.accent }]} />

        {/* ── 2. HEADER ─────────────────────────────────────── */}
        <View style={[s.header, s.sep]}>
          {/* Left: brand identity */}
          <View style={s.headerLeft}>
            {brand.logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={brand.logoUrl} style={s.logo} />
            ) : null}
            <View>
              <Text style={s.businessName}>{brand.businessName}</Text>
              {brand.legalName ? (
                <Text style={s.headerLine}>{brand.legalName}</Text>
              ) : null}
              {brand.contact.email ? (
                <Text style={s.headerLine}>{brand.contact.email}</Text>
              ) : null}
              {brand.contact.phone ? (
                <Text style={s.headerLine}>{brand.contact.phone}</Text>
              ) : null}
            </View>
          </View>

          {/* Right: document identity */}
          <View style={s.headerRight}>
            <Text style={[s.docEyebrow, { color: brand.accent }]}>
              {eyebrow}
            </Text>
            <Text style={s.docTitle}>{data.title}</Text>
            {data.status === "signed" ? (
              <Text style={s.docSubtitle}>Signed copy</Text>
            ) : null}
            <Badge
              tone={statusTone}
              brandAccent={brand.accent}
              label={statusLabel}
            />
          </View>
        </View>

        {/* ── 3. META ROW ───────────────────────────────────── */}
        <View style={[s.metaRow, s.sep]}>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Issued</Text>
            <Text style={s.metaValue}>{formatDate(data.issuedAt)}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Expires</Text>
            <Text style={s.metaValue}>
              {data.expiresAt ? formatDate(data.expiresAt) : "Open"}
            </Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Value</Text>
            <Text style={s.metaValue}>
              {data.valueAmount !== null
                ? formatCurrency(data.valueAmount, data.currency)
                : "To be agreed"}
            </Text>
          </View>
        </View>

        {/* ── 4. PARTIES ────────────────────────────────────── */}
        <View style={[s.parties, s.sep]}>
          {/* Seller */}
          <View style={s.partyCol}>
            <Text style={s.partyEyebrow}>Between</Text>
            <Text style={s.partyName}>{brand.businessName}</Text>
            {brand.legalName ? (
              <Text style={s.partyLine}>{brand.legalName}</Text>
            ) : null}
            {brand.addressLines.slice(0, 4).map((line, i) => (
              <Text key={i} style={s.partyLine}>{line}</Text>
            ))}
            {brand.contact.email ? (
              <Text style={s.partyLine}>{brand.contact.email}</Text>
            ) : null}
            {brand.contact.phone ? (
              <Text style={s.partyLine}>{brand.contact.phone}</Text>
            ) : null}
          </View>

          {/* Client */}
          <View style={s.partyColRight}>
            <Text style={s.partyEyebrow}>And</Text>
            <Text style={s.partyName}>{data.client.name}</Text>
            {data.client.detailLines.slice(0, 6).map((line, i) => (
              <Text key={i} style={s.partyLine}>{line}</Text>
            ))}
          </View>
        </View>

        {/* ── 5. BODY ───────────────────────────────────────── */}
        <View>
          {parsedContent.sections.length > 0
            ? parsedContent.sections.map((section, i) => (
                <View key={i} style={s.section} wrap={true}>
                  <View style={s.numberRow}>
                    <Text style={s.sectionNumber}>
                      {String(i + 1).padStart(2, "0")}
                    </Text>
                    <Text style={s.sectionHeading}>{section.heading}</Text>
                  </View>
                  <Text style={s.sectionBody}>{section.body}</Text>
                </View>
              ))
            : parsedContent.paragraphs.map((p, i) => (
                <Text key={i} style={s.sectionBody}>
                  {p}
                </Text>
              ))}
        </View>

        {/* ── 6. SIGNATURES ─────────────────────────────────── */}
        {/* Always render for both contracts and proposals.
            Contracts show the actual signature data; proposals show empty
            placeholder lines so clients know exactly where to sign. */}
        <View style={s.signaturePair} wrap={false}>
          <View style={s.signatureSlot}>
            <SignatureBlock
              label={`Signed for ${brand.businessName}`}
              signature={
                isContract && hasSignatureReference(data.seller.signature)
                  ? coerceSignature(
                      data.seller.signature,
                      data.seller.signature.signedAt ?? data.issuedAt,
                    )
                  : null
              }
              fallbackName={
                data.seller.signature?.legalName ??
                data.seller.legalName ??
                brand.businessName
              }
              width={240}
            />
          </View>
          <View style={s.signatureSpacer} />
          <View style={s.signatureSlot}>
            <SignatureBlock
              label={`Signed for ${data.client.name}`}
              signature={
                isContract && hasSignatureReference(data.clientSignature)
                  ? coerceSignature(
                      data.clientSignature!,
                      data.clientSignature!.signedAt ?? data.signedAt,
                      data.clientSignature?.signedIp ?? null,
                    )
                  : null
              }
              fallbackName={
                data.clientSignature?.legalName ??
                data.signerName ??
                data.client.name
              }
              width={240}
            />
          </View>
        </View>

        {/* ── 7. FOOTER (fixed on every page) ───────────────── */}
        <DocumentFooter
          brand={brand}
          label={`${eyebrow.charAt(0)}${eyebrow.slice(1).toLowerCase()} · ${data.title}`}
        />
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function coerceSignature(
  ref: ContractSignatureReference & { type: ContractSignatureType },
  signedAt: string | null,
  signedIp: string | null = null,
): SignatureData {
  return {
    type: ref.type,
    imageUrl: ref.imageUrl ?? null,
    textValue: ref.textValue ?? null,
    fontFamily: ref.fontFamily ?? null,
    legalName: (ref as { legalName?: string | null }).legalName ?? null,
    signedAt,
    signedIp,
  };
}

function buildBrandFromData(
  data: ContractPdfData,
  seller?: UserProfileRow | null,
  logoDataUrl?: string | null,
): ResolvedBrand {
  if (seller) return resolveBrand(seller, logoDataUrl ?? data.seller.logoDataUrl);
  const shim = {
    business_name: data.seller.businessName,
    company_name: null,
    legal_name: data.seller.legalName,
    full_name: null,
    brand_color: data.brandColor,
    brand_tagline: null,
    business_email: data.seller.email,
    email: null,
    business_phone: data.seller.phone,
    phone: null,
    website: null,
    address_line1: data.seller.addressLines[0] ?? null,
    address_line2: data.seller.addressLines[1] ?? null,
    city: data.seller.addressLines[2] ?? null,
    postal_code: data.seller.addressLines[3] ?? null,
    country: null,
    gstin: null,
    gst_number: null,
    pan: null,
    state_code: null,
  } as unknown as UserProfileRow;
  return resolveBrand(shim, data.seller.logoDataUrl);
}
