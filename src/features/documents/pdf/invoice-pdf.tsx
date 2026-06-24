import "server-only";

/**
 * Invoice PDF — redesigned to mirror the public invoice web page.
 *
 * Layout (matches /i/[token] exactly):
 *   1. Brand accent bar (full-width, top of page)
 *   2. Header   — logo + business name/email left │ INVOICE eyebrow + number + badge right
 *   3. Hero row — "Amount Due / INR X" left       │ Issue date / Due date / Type right
 *   4. Parties  — From left                       │ Billed To right   (vertical divider)
 *   5. Line items table
 *   6. Totals (right-aligned)
 *   7. Notes / Terms (side-by-side if both present)
 *   8. Signature (left-aligned)
 *   9. Fixed branded footer
 *
 * Everything is written inline — no heavy primitives wrappers that fight
 * with react-pdf's layout model. The helpers (formatDate, formatCurrency,
 * SignatureBlock, NoteBlock, LineItemsTable, DocumentFooter, Badge) are
 * still imported from ./primitives.
 */

import * as React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  pdfColors,
  pdfFonts,
  pdfLineHeights,
  pdfPage,
  pdfRadii,
  pdfSizes,
  pdfSpacing,
  pdfTracking,
} from "./theme";
import { resolveBrand, type ResolvedBrand } from "./brand";
import {
  Badge,
  DocumentFooter,
  LineItemsTable,
  NoteBlock,
  SignatureBlock,
  TableCellText,
  TotalsBlock,
  formatCurrency,
  formatDate,
  type BadgeTone,
  type SignatureData,
  type TableColumn,
} from "./primitives";
import type { UserProfileRow } from "@/lib/supabase/types";
import { amountInWordsINR } from "@/lib/number-to-words";
import { getStateName } from "@/features/gst/state-codes";

// ---------------------------------------------------------------------------
// Data shapes (unchanged contract with builders.ts)
// ---------------------------------------------------------------------------

export interface InvoicePdfItem {
  description: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  amount: number;
}

export interface InvoicePdfSeller {
  businessName: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  pan: string | null;
  addressLines: string[];
  stateCode: string | null;
  logoDataUrl: string | null;
  website: string | null;
  signature: (SignatureData & { legalName: string | null }) | null;
}

export interface InvoicePdfClient {
  name: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  gstin: string | null;
  stateCode: string | null;
  addressLines: string[];
}

export interface InvoicePdfData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  isExport?: boolean;
  status: string;
  paymentStatus: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  paymentAmount: number | null;
  paymentRecordedAt: string | null;
  brandColor: string | null;
  taxMode: "non_gst" | "cgst_sgst" | "igst";
  classification: "standard" | "b2c" | "b2b";
  subtotal: number;
  discount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxTotal: number;
  totalAmount: number;
  notes: string | null;
  terms: string | null;
  footerNote: string | null;
  hsnSac: string | null;
  paymentLink: string | null;
  publicUrl: string | null;
  items: InvoicePdfItem[];
  seller: InvoicePdfSeller;
  client: InvoicePdfClient;
}

// ---------------------------------------------------------------------------
// Stylesheet — all values from theme tokens, nothing magic inline
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

  // ── accent bar ──────────────────────────────────────────────────────────
  accentBar: {
    height: 4,
    marginHorizontal: -PAD,
    marginTop: -PAD,
    marginBottom: 18,
  },

  // ── shared row separator ────────────────────────────────────────────────
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
    maxWidth: "62%",
  },
  logo: {
    width: 72,
    maxWidth: 96,
    height: 44,
    objectFit: "contain",
    marginRight: 12,
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
  invoiceNumber: {
    fontFamily: pdfFonts.bold,
    fontSize: 22,
    color: pdfColors.foreground,
    letterSpacing: pdfTracking.tight,
    lineHeight: pdfLineHeights.tight,
    marginBottom: 6,
  },

  // ── hero row ────────────────────────────────────────────────────────────
  hero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  amountEyebrow: {
    fontFamily: pdfFonts.bold,
    fontSize: pdfSizes.eyebrow,
    color: pdfColors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: pdfTracking.wider,
    marginBottom: 5,
  },
  amountValue: {
    fontFamily: pdfFonts.bold,
    fontSize: 28,
    color: pdfColors.foreground,
    letterSpacing: pdfTracking.tight,
    lineHeight: pdfLineHeights.tight,
  },
  amountSub: {
    fontSize: pdfSizes.sm,
    marginTop: 5,
  },
  dateGrid: {
    flexDirection: "row",
    width: 286,
    borderWidth: 0.5,
    borderColor: pdfColors.borderStrong,
    backgroundColor: pdfColors.surfaceMuted,
  },
  dateCell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderLeftWidth: 0.5,
    borderLeftColor: pdfColors.border,
  },
  dateCellSupply: {
    flex: 1.35,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderLeftWidth: 0.5,
    borderLeftColor: pdfColors.border,
  },
  dateLabel: {
    fontFamily: pdfFonts.bold,
    fontSize: pdfSizes.eyebrow,
    color: pdfColors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: pdfTracking.wider,
    marginBottom: 4,
  },
  dateValue: {
    fontFamily: pdfFonts.bold,
    fontSize: pdfSizes.sm,
    color: pdfColors.foreground,
    lineHeight: pdfLineHeights.tight,
  },

  // ── parties ─────────────────────────────────────────────────────────────
  parties: {
    flexDirection: "row",
    borderWidth: 0.5,
    borderColor: pdfColors.borderStrong,
    backgroundColor: pdfColors.surface,
  },
  partyCol: {
    flex: 1,
    padding: pdfSpacing.md,
  },
  partyColRight: {
    flex: 1,
    padding: pdfSpacing.md,
    borderLeftWidth: 0.5,
    borderLeftColor: pdfColors.border,
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

  // ── notes / terms side by side ──────────────────────────────────────────
  notesRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  notesLeft: {
    flex: 1,
    marginRight: 16,
  },
  notesRight: {
    flex: 1,
  },
  legal: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: pdfColors.border,
  },
  legalLine: {
    fontSize: pdfSizes.xs,
    color: pdfColors.text,
    lineHeight: pdfLineHeights.snug,
    marginBottom: 5,
  },
  legalMetaRow: {
    flexDirection: "row",
    marginTop: 1,
    marginBottom: 5,
  },
  legalMetaItem: {
    marginRight: 16,
  },
  legalDecl: {
    fontSize: pdfSizes.xs,
    color: pdfColors.mutedForeground,
    lineHeight: pdfLineHeights.snug,
    marginTop: 3,
  },
});

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export function InvoicePdf({
  data,
  seller,
  logoDataUrl,
}: {
  data: InvoicePdfData;
  seller?: UserProfileRow | null;
  logoDataUrl?: string | null;
}) {
  const brand = buildBrandFromData(data, seller, logoDataUrl);
  const isGstRegistered = Boolean(data.seller.gstin);
  const isBillOfSupply = data.taxMode === "non_gst" && isGstRegistered;
  const docLabel =
    data.taxMode !== "non_gst"
      ? "Tax Invoice"
      : isGstRegistered
        ? "Bill of Supply"
        : "Invoice";
  const totals = resolveTotals(data);
  const isPaid = data.status === "paid";
  const isOverdue = data.status === "overdue";

  const isCancelled = data.status === "cancelled";
  // A clean issued invoice carries no workflow pill — "sent"/"viewed" are
  // internal states, not something the client should see stamped on the doc.
  // Drafts keep a DRAFT marker (safety); paid/overdue/partial/cancelled show.
  const showStatusBadge = data.status !== "sent" && data.status !== "viewed";
  const statusTone: BadgeTone = isPaid
    ? "success"
    : isOverdue
      ? "danger"
      : data.status === "draft" || isCancelled
        ? "neutral"
        : "brand";
  const statusLabel = isCancelled
    ? "Cancelled"
    : data.status === "partially_paid"
      ? "Partially paid"
      : data.status.replace(/_/g, " ");

  const amountEyebrow = isPaid
    ? "Amount paid"
    : isOverdue
      ? "Amount overdue"
      : "Amount due";

  const amountSubColor = isPaid
    ? pdfColors.success
    : isOverdue
      ? pdfColors.danger
      : pdfColors.mutedForeground;

  const paidSoFar =
    data.status === "partially_paid" && safe(data.paymentAmount) > 0
      ? Math.min(safe(data.paymentAmount), totals.total)
      : 0;
  const heroAmount = isPaid
    ? totals.paidAmount
    : round(totals.total - paidSoFar);

  const paidMethodSuffix = [
    data.paymentMethod,
    data.paymentReference ? `Ref ${data.paymentReference}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const amountSubText = isPaid
    ? `Paid on ${formatDate(data.paidAt ?? data.paymentRecordedAt)}${paidMethodSuffix ? ` · ${paidMethodSuffix}` : ""}`
    : paidSoFar > 0
      ? `${formatCurrency(paidSoFar, data.currency)} received · balance due ${formatDate(data.dueDate)}`
      : null;

  return (
    <Document
      title={`${docLabel} ${data.invoiceNumber}`}
      author={brand.businessName}
      subject={`${docLabel} for ${data.client.name}`}
    >
      <Page size="A4" style={s.page}>

        {/* Fixed footer — declared first so it repeats on every page */}
        <DocumentFooter
          brand={brand}
          label={`${docLabel} ${data.invoiceNumber}`}
        />

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
              {brand.contact.phone ? (
                <Text style={s.headerLine}>{brand.contact.phone}</Text>
              ) : null}
            </View>
          </View>

          {/* Right: document identity */}
          <View style={s.headerRight}>
            <Text style={[s.docEyebrow, { color: brand.accent }]}>
              {docLabel.toUpperCase()}
            </Text>
            <Text style={s.invoiceNumber}>{data.invoiceNumber}</Text>
            {showStatusBadge ? (
              <Badge tone={statusTone} brandAccent={brand.accent} label={statusLabel} />
            ) : null}
          </View>
        </View>

        {/* ── 3. HERO — Amount left, dates right ────────────── */}
        <View style={[s.hero, s.sep]}>
          {/* Amount */}
          <View>
            <Text style={s.amountEyebrow}>{amountEyebrow}</Text>
            <Text style={s.amountValue}>
              {formatCurrency(heroAmount, data.currency)}
            </Text>
            {amountSubText ? (
              <Text style={[s.amountSub, { color: amountSubColor }]}>
                {amountSubText}
              </Text>
            ) : null}
          </View>

          {/* Dates grid */}
          <View style={s.dateGrid}>
            <View style={[s.dateCell, { borderLeftWidth: 0 }]}>
              <Text style={s.dateLabel}>Issue date</Text>
              <Text style={s.dateValue}>{formatDate(data.issueDate)}</Text>
            </View>
            <View style={s.dateCell}>
              <Text style={s.dateLabel}>Due date</Text>
              <Text
                style={[
                  s.dateValue,
                  { color: isOverdue ? pdfColors.danger : pdfColors.foreground },
                ]}
              >
                {formatDate(data.dueDate)}
              </Text>
            </View>
            <View style={s.dateCellSupply}>
              {data.taxMode !== "non_gst" ? (
                <>
                  <Text style={s.dateLabel}>Place of supply</Text>
                  <Text style={s.dateValue}>{formatPlaceOfSupply(data.client.stateCode)}</Text>
                </>
              ) : (
                <>
                  <Text style={s.dateLabel}>Type</Text>
                  <Text style={s.dateValue}>{docLabel}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* ── 4. PARTIES ────────────────────────────────────── */}
        <View style={[s.parties, s.sep]}>
          {/* From */}
          <View style={s.partyCol}>
            <Text style={s.partyEyebrow}>From</Text>
            <Text style={s.partyName}>{brand.businessName}</Text>
            {brand.addressLines.slice(0, 2).map((line, i) => (
              <Text key={i} style={s.partyLine}>{line}</Text>
            ))}
            {brand.contact.email ? (
              <Text style={s.partyLine}>{brand.contact.email}</Text>
            ) : null}
            {brand.gstin ? (
              <Text style={s.partyLine}>GSTIN: {brand.gstin}</Text>
            ) : null}
          </View>

          {/* Billed to */}
          <View style={s.partyColRight}>
            <Text style={s.partyEyebrow}>Billed To</Text>
            <Text style={s.partyName}>{data.client.name}</Text>
            {data.client.companyName ? (
              <Text style={s.partyLine}>{data.client.companyName}</Text>
            ) : null}
            {data.client.addressLines.slice(0, 2).map((line, i) => (
              <Text key={i} style={s.partyLine}>{line}</Text>
            ))}
            {data.client.email ? (
              <Text style={s.partyLine}>{data.client.email}</Text>
            ) : null}
            {data.client.gstin ? (
              <Text style={s.partyLine}>GSTIN: {data.client.gstin}</Text>
            ) : null}
          </View>
        </View>

        {/* ── 5. LINE ITEMS ─────────────────────────────────── */}
        <LineItemsTable<InvoicePdfItem>
          brand={brand}
          rows={data.items}
          columns={INVOICE_COLUMNS(data)}
        />

        {/* ── 6. TOTALS ─────────────────────────────────────── */}
        <TotalsBlock
          brandAccent={brand.accent}
          rows={buildTotalsRows(data, totals, paidSoFar)}
          grand={{
            label: isPaid
              ? "Total paid"
              : paidSoFar > 0
                ? "Balance due"
                : "Amount due",
            value: formatCurrency(
              isPaid ? totals.total : round(totals.total - paidSoFar),
              data.currency,
            ),
          }}
        />

        {/* ── 6b. LEGAL BLOCK — words, HSN/SAC, reverse charge, declaration ── */}
        <View style={s.legal}>
          <Text style={s.legalLine}>
            Amount in words: {amountInWordsINR(data.totalAmount)}
          </Text>
          {data.taxMode !== "non_gst" ? (
            <View style={s.legalMetaRow}>
              {data.hsnSac ? (
                <Text style={[s.legalLine, s.legalMetaItem]}>
                  HSN/SAC: {data.hsnSac}
                </Text>
              ) : null}
              <Text style={s.legalLine}>Tax payable on reverse charge: No</Text>
            </View>
          ) : null}
          {isBillOfSupply ? (
            <Text style={s.legalLine}>
              This is a Bill of Supply. No GST is charged on this document.
            </Text>
          ) : null}
          <Text style={s.legalDecl}>
            Declaration: We declare that this {docLabel.toLowerCase()} shows the actual price
            of the goods / services described and that all particulars are true and correct.
          </Text>
        </View>

        {/* ── 7+8. CLOSING BLOCK (kept together) ─────────────── */}
        {(data.notes || data.terms) ? (
          <View style={s.notesRow}>
            {data.notes ? (
              <View style={data.terms ? s.notesLeft : { flex: 1 }}>
                <NoteBlock label="Notes" accent={brand.accent}>
                  {data.notes}
                </NoteBlock>
              </View>
            ) : null}
            {data.terms ? (
              <View style={data.notes ? s.notesRight : { flex: 1 }}>
                <NoteBlock label="Terms" accent={brand.accent}>
                  {data.terms}
                </NoteBlock>
              </View>
            ) : null}
          </View>
        ) : null}

        
        {data.seller.signature ? (
          <SignatureBlock
            label="Authorised signature"
            signature={data.seller.signature}
            fallbackName={brand.businessName}
          />
        ) : null}

      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

function INVOICE_COLUMNS(data: InvoicePdfData): TableColumn<InvoicePdfItem>[] {
  return [
    {
      key: "desc",
      header: "Description",
      flex: 3,
      render: (it) => <TableCellText>{it.description}</TableCellText>,
    },
    {
      key: "qty",
      header: "Qty",
      flex: 0.7,
      align: "right",
      render: (it) => (
        <TableCellText align="right">
          {Number.isInteger(it.quantity)
            ? String(it.quantity)
            : it.quantity.toFixed(2)}
        </TableCellText>
      ),
    },
    {
      key: "rate",
      header: "Rate",
      flex: 1.5,
      align: "right",
      render: (it) => (
        <TableCellText align="right">
          {formatCurrency(it.unitPrice, data.currency)}
        </TableCellText>
      ),
    },
    {
      key: "gst",
      header: "GST",
      flex: 0.7,
      align: "right",
      render: (it) => (
        <TableCellText align="right">
          {data.taxMode === "non_gst" ? "—" : `${it.gstRate}%`}
        </TableCellText>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      flex: 1.6,
      align: "right",
      render: (it) => (
        <TableCellText align="right" bold>
          {formatCurrency(it.amount, data.currency)}
        </TableCellText>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Totals rows
// ---------------------------------------------------------------------------

function buildTotalsRows(
  data: InvoicePdfData,
  totals: ReturnType<typeof resolveTotals>,
  paidSoFar = 0,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: "Subtotal", value: formatCurrency(totals.subtotal, data.currency) },
  ];
  if (totals.discount > 0) {
    rows.push({ label: "Discount", value: `-${formatCurrency(totals.discount, data.currency)}` });
  }
  if (data.isExport) {
    rows.push({ label: "GST", value: "Zero-rated export (LUT)" });
  } else if (data.taxMode === "cgst_sgst") {
    rows.push({ label: "CGST", value: formatCurrency(totals.cgstAmount, data.currency) });
    rows.push({ label: "SGST", value: formatCurrency(totals.sgstAmount, data.currency) });
  } else if (data.taxMode === "igst") {
    rows.push({ label: "IGST", value: formatCurrency(totals.igstAmount, data.currency) });
  } else {
    rows.push({ label: "GST", value: "Not applicable" });
  }
  rows.push({
    label: "Total",
    value: formatCurrency(totals.total, data.currency),
  });
  if (paidSoFar > 0) {
    rows.push({
      label: "Paid to date",
      value: `-${formatCurrency(paidSoFar, data.currency)}`,
    });
  }
  return rows;
}

function formatPlaceOfSupply(stateCode: string | null): string {
  if (!stateCode) return "-";
  const stateName = getStateName(stateCode);
  return stateName && stateName !== stateCode ? `${stateName} (${stateCode})` : stateCode;
}

// ---------------------------------------------------------------------------
// Brand resolver
// ---------------------------------------------------------------------------

function buildBrandFromData(
  data: InvoicePdfData,
  seller?: UserProfileRow | null,
  logoDataUrl?: string | null,
): ResolvedBrand {
  if (seller) {
    return resolveBrand(seller, logoDataUrl ?? data.seller.logoDataUrl);
  }
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
    gstin: data.seller.gstin,
    gst_number: null,
    pan: data.seller.pan,
    state_code: data.seller.stateCode,
  } as unknown as UserProfileRow;
  return resolveBrand(shim, data.seller.logoDataUrl);
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function resolveTotals(data: InvoicePdfData) {
  const lineSubtotal = round(
    data.items.reduce((sum, item) => sum + safe(item.amount), 0),
  );
  const subtotal = pos(data.subtotal, lineSubtotal);
  const discount = Math.min(subtotal, safe(data.discount));
  const lineTax = computeLineTax(data);
  const cgstAmount = pos(data.cgstAmount, lineTax.cgst);
  const sgstAmount = pos(data.sgstAmount, lineTax.sgst);
  const igstAmount = pos(data.igstAmount, lineTax.igst);
  const taxTotal = pos(data.taxTotal, round(cgstAmount + sgstAmount + igstAmount));
  const total = pos(data.totalAmount, round(subtotal - discount + taxTotal) || subtotal);
  const paidAmount = pos(data.paymentAmount, total);
  return { subtotal, discount, cgstAmount, sgstAmount, igstAmount, taxTotal, total, paidAmount };
}

function computeLineTax(data: InvoicePdfData) {
  if (data.taxMode === "non_gst") return { cgst: 0, sgst: 0, igst: 0 };
  return data.items.reduce(
    (sum, item) => {
      const amount = safe(item.amount);
      const rate = safe(item.gstRate);
      if (data.taxMode === "igst") {
        sum.igst += round((amount * rate) / 100);
      } else {
        const half = round((amount * rate) / 200);
        sum.cgst += half;
        sum.sgst += half;
      }
      return sum;
    },
    { cgst: 0, sgst: 0, igst: 0 },
  );
}

function safe(value: number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
function pos(value: number | null | undefined, fallback: number): number {
  const n = safe(value);
  return n > 0 ? n : fallback;
}

// Keep pdfPage imported to avoid unused-import lint errors from the barrel.
void pdfPage;
