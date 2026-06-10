import "server-only";

/**
 * Welcome Document PDF — single-document layout matching invoice/contract quality.
 *
 * No separate cover page. Everything flows on one document:
 *   1. Brand accent bar   (full-bleed, 4px)
 *   2. Header             — logo + business name left │ "WELCOME GUIDE" + title right
 *   3. Meta row           — Published │ Sections │ Read time
 *   4. Parties            — Prepared for left │ Prepared by right (vertical divider)
 *   5. Intro              — if present, with bottom separator
 *   6. Sections           — numbered 01, 02 … wrap={false} keeps heading+body together
 *   7. "What happens next" callout
 *   8. Fixed branded footer
 *
 * Same discipline as invoice-pdf.tsx and contract-pdf.tsx.
 */

import * as React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { WelcomeDocumentSection } from "@/features/welcome-documents/types";
import { welcomeMarkdownToPlain } from "@/features/welcome-documents/markdown";
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
  DocumentFooter,
  NoteBlock,
  formatDate,
} from "./primitives";
import type { UserProfileRow } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Data shape (preserved exactly)
// ---------------------------------------------------------------------------

export interface WelcomeDocumentPdfData {
  title: string;
  intro: string | null;
  sections: WelcomeDocumentSection[];
  brandColor: string | null;
  publishedAt: string | null;
  publicUrl: string | null;
  acknowledgementRequired: boolean;
  seller: {
    businessName: string;
    legalName: string | null;
    email: string | null;
    phone: string | null;
    addressLines: string[];
    logoDataUrl: string | null;
    website: string | null;
  };
  recipient: {
    name: string | null;
    company: string | null;
    email: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Stylesheet — mirrors invoice-pdf.tsx conventions exactly
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
    paddingBottom: PAD + 28,
    // NOTE: never set lineHeight on the Page style — react-pdf stops
    // rendering fixed/absolute children (the footer) when it is present.
  },

  // ── accent bar ──────────────────────────────────────────────────────────
  accentBar: {
    height: 4,
    marginHorizontal: -PAD,
    marginTop: -PAD,
    marginBottom: 18,
  },

  // ── shared separator ────────────────────────────────────────────────────
  sep: {
    borderBottomWidth: 0.5,
    borderBottomColor: pdfColors.border,
    marginBottom: 14,
    paddingBottom: 14,
  },

  // ── header ──────────────────────────────────────────────────────────────
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
  },
  docEyebrow: {
    fontFamily: pdfFonts.bold,
    fontSize: pdfSizes.eyebrow,
    textTransform: "uppercase",
    letterSpacing: pdfTracking.wider,
    marginBottom: 5,
  },
  docTitle: {
    fontFamily: pdfFonts.bold,
    fontSize: pdfSizes.xl,
    color: pdfColors.foreground,
    letterSpacing: pdfTracking.tight,
    lineHeight: pdfLineHeights.tight,
    textAlign: "right",
  },

  // ── meta row (Published | Sections | Read time) ──────────────────────────
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

  // ── parties (Prepared for | Prepared by) ─────────────────────────────────
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

  // ── intro ────────────────────────────────────────────────────────────────
  intro: {
    fontSize: pdfSizes.sm,
    lineHeight: pdfLineHeights.relaxed,
    color: pdfColors.text,
    marginBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: pdfColors.border,
    paddingBottom: 10,
  },

  // ── sections ─────────────────────────────────────────────────────────────
  section: {
    marginBottom: 10,
  },
  sectionRow: {
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
    lineHeight: pdfLineHeights.relaxed,
    color: pdfColors.text,
    marginTop: 3,
  },

  // ── "what happens next" ───────────────────────────────────────────────────
  nextEyebrow: {
    fontFamily: pdfFonts.bold,
    fontSize: pdfSizes.eyebrow,
    color: pdfColors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: pdfTracking.wider,
    marginTop: 12,
    marginBottom: 6,
  },
});

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export function WelcomeDocumentPdf({
  data,
  seller,
  logoDataUrl,
}: {
  data: WelcomeDocumentPdfData;
  seller?: UserProfileRow | null;
  logoDataUrl?: string | null;
}) {
  const brand = buildBrandFromData(data, seller, logoDataUrl);
  const intro = data.intro?.trim() ? welcomeMarkdownToPlain(data.intro) : null;

  return (
    <Document title={`Welcome guide – ${data.title}`} author={brand.businessName}>
      <Page size="A4" style={s.page}>

        {/* ── 1. ACCENT BAR ─────────────────────────────────── */}
        <View style={[s.accentBar, { backgroundColor: brand.accent }]} />

        {/* ── 2. HEADER ─────────────────────────────────────── */}
        <View style={[s.header, s.sep]}>
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
          <View style={s.headerRight}>
            <Text style={[s.docEyebrow, { color: brand.accent }]}>
              Welcome Guide
            </Text>
            <Text style={s.docTitle}>{data.title}</Text>
          </View>
        </View>

        {/* ── 3. META ROW ───────────────────────────────────── */}
        <View style={[s.metaRow, s.sep]}>
          {data.publishedAt ? (
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Published</Text>
              <Text style={s.metaValue}>{formatDate(data.publishedAt)}</Text>
            </View>
          ) : null}
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Sections</Text>
            <Text style={s.metaValue}>{data.sections.length}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Read time</Text>
            <Text style={s.metaValue}>{estimateReadMinutes(data)} min</Text>
          </View>
        </View>

        {/* ── 4. PARTIES ────────────────────────────────────── */}
        <View style={[s.parties, s.sep]}>
          <View style={s.partyCol}>
            <Text style={s.partyEyebrow}>Prepared for</Text>
            <Text style={s.partyName}>
              {data.recipient?.name ?? "Your team"}
            </Text>
            {data.recipient?.company ? (
              <Text style={s.partyLine}>{data.recipient.company}</Text>
            ) : null}
            {data.recipient?.email ? (
              <Text style={s.partyLine}>{data.recipient.email}</Text>
            ) : null}
          </View>
          <View style={s.partyColRight}>
            <Text style={s.partyEyebrow}>Prepared by</Text>
            <Text style={s.partyName}>{brand.businessName}</Text>
            {brand.contact.email ? (
              <Text style={s.partyLine}>{brand.contact.email}</Text>
            ) : null}
            {brand.contact.phone ? (
              <Text style={s.partyLine}>{brand.contact.phone}</Text>
            ) : null}
          </View>
        </View>

        {/* ── 5. INTRO ──────────────────────────────────────── */}
        {intro && data.sections.length > 0 ? (
          <Text style={s.intro}>{intro}</Text>
        ) : null}

        {/* ── 6. SECTIONS ───────────────────────────────────── */}
        <View>
          {data.sections.length > 0 ? (
            data.sections.map((section, i) => (
              <View key={i} style={s.section} wrap={false}>
                <View style={s.sectionRow}>
                  <Text style={s.sectionNumber}>
                    {String(i + 1).padStart(2, "0")}
                  </Text>
                  <Text style={s.sectionHeading}>{section.heading}</Text>
                </View>
                <Text style={s.sectionBody}>
                  {welcomeMarkdownToPlain(section.body)}
                </Text>
              </View>
            ))
          ) : intro ? (
            <Text style={s.sectionBody}>{intro}</Text>
          ) : (
            <Text style={s.sectionBody}>
              This guide is being prepared — content will follow shortly.
            </Text>
          )}
        </View>

        {/* ── 7. WHAT HAPPENS NEXT ──────────────────────────── */}
        <Text style={s.nextEyebrow}>What happens next</Text>
        <NoteBlock accent={brand.accent}>
          {data.acknowledgementRequired && data.publicUrl
            ? `Once you've read through the guide, please confirm at the bottom of the online version (${data.publicUrl}). That's the handshake to kick the project off.`
            : `Reply to the email this guide arrived on with any questions — we'll incorporate them into the kickoff conversation.`}
        </NoteBlock>

        {/* ── 8. FOOTER ─────────────────────────────────────── */}
        <DocumentFooter brand={brand} label={`Welcome guide · ${data.title}`} />
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estimateReadMinutes(data: WelcomeDocumentPdfData): number {
  const words =
    (data.intro?.split(/\s+/).length ?? 0) +
    data.sections.reduce(
      (sum, s) => sum + (s.body?.split(/\s+/).length ?? 0),
      0,
    );
  return Math.max(1, Math.round(words / 220));
}

function buildBrandFromData(
  data: WelcomeDocumentPdfData,
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
    website: data.seller.website,
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
