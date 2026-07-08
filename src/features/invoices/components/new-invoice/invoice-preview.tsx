"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { InvoiceTotalsBreakdown } from "./invoice-totals";
import { computeItemAmount } from "../../schema";
import { useProfile } from "@/features/profile/context";
import { hasFreelancerSignature } from "@/features/profile/signature";
import type {
  InvoiceFormValues,
  InvoiceTotals,
} from "../../schema";

interface InvoicePreviewProps {
  values: InvoiceFormValues;
  totals: InvoiceTotals;
  clientName?: string;
  clientCompany?: string;
  clientEmail?: string;
  currency?: string;
}

/**
 * Professional paper-like invoice preview. Shows what the recipient
 * will approximately see — branding, line items, totals, and a single
 * authorised signature block.
 *
 * Removed:
 *   - "Payment method" block  → not needed for the client-facing preview
 *   - Duplicate "Authorized Signature" → the freelancer signature IS the
 *     authorised signature; one block is enough
 */
export function InvoicePreview({
  values,
  totals,
  clientName,
  clientCompany,
  clientEmail,
  currency = "INR",
}: InvoicePreviewProps) {
  const { profile } = useProfile();
  const issueDate = values.issueDate
    ? new Date(values.issueDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
  const dueDate = values.dueDate
    ? new Date(values.dueDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
  const businessName =
    profile?.businessName ?? profile?.legalName ?? profile?.fullName ?? "Your studio";
  const tagline = profile?.brandTagline ?? "Freelance operations";
  const accent = profile?.brandColor ?? "#0F172A";
  const signatureReady = hasFreelancerSignature(profile);

  // Show only the first 2 address lines so the preview stays clean.
  const fromLines = [
    profile?.addressLine1,
    profile?.addressLine2,
  ].filter((v): v is string => Boolean(v && v.trim()));

  return (
    <div className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xl shadow-black/5 ring-1 ring-border/70">
      {/* Top accent rule */}
      <div className="h-1 w-full" style={{ backgroundColor: accent }} />

      <div className="relative p-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {profile?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.logoUrl}
                alt={businessName}
                className="h-10 w-10 rounded object-contain"
              />
            ) : (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-sm font-bold text-white"
                style={{ backgroundColor: accent }}
              >
                {businessName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold">{businessName}</p>
              <p className="text-[11px] text-muted-foreground">{tagline}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tracking-tight">
              {values.invoiceNumber || "INV-—"}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Tax Invoice
            </p>
          </div>
        </div>

        {/* From / Bill to / Dates — 3 columns */}
        <div className="mb-8 grid grid-cols-3 gap-4 text-[11px]">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              From
            </p>
            <p className="text-sm font-semibold text-card-foreground">{businessName}</p>
            {fromLines.length > 0 ? (
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {fromLines.join(", ")}
              </p>
            ) : null}
            {profile?.gstRegistered && profile?.gstin ? (
              <p className="text-[11px] text-muted-foreground">GSTIN {profile.gstin}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground/80">GST not registered</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Bill To
            </p>
            <p className="text-sm font-semibold text-card-foreground">
              {clientName || "—"}
            </p>
            {clientCompany && (
              <p className="text-[11px] text-muted-foreground">{clientCompany}</p>
            )}
            {clientEmail && (
              <p className="text-[11px] text-muted-foreground">{clientEmail}</p>
            )}
          </div>
          <div className="text-right">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Dates
            </p>
            <p className="text-[11px] text-muted-foreground">
              Issued <span className="font-medium text-card-foreground">{issueDate}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Due <span className="font-medium text-card-foreground">{dueDate}</span>
            </p>
          </div>
        </div>

        {/* Line items — proper table for correct column alignment */}
        <div className="mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 text-left">Description</th>
                <th className="pb-2 w-10 text-right">Qty</th>
                <th className="pb-2 w-28 text-right pr-4">Rate</th>
                <th className="pb-2 w-28 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {values.items && values.items.length > 0 ? (
                values.items.map((item, i) => (
                  <tr
                    key={item.id ?? i}
                    className="border-b border-border/70 last:border-b-0"
                  >
                    <td className="py-3 text-card-foreground">
                      {item.description || (
                        <span className="text-muted-foreground">Untitled item</span>
                      )}
                    </td>
                    <td className="py-3 text-right tabular-nums text-muted-foreground">
                      {item.quantity || 0}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                      {formatMoney(Number(item.rate) || 0, currency)}
                    </td>
                    <td className="py-3 text-right font-medium tabular-nums text-card-foreground">
                      {formatMoney(computeItemAmount({ quantity: item.quantity, rate: item.rate }), currency)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                    No items added yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mb-8 flex justify-end">
          <div className="w-64">
            <InvoiceTotalsBreakdown
              totals={totals}
              gstRate={values.gstRate}
              taxMode={values.taxMode}
              currency={currency}
              variant="document"
              className={cn("[&>div>span:first-child]:text-muted-foreground")}
            />
          </div>
        </div>

        {/* Signature — single authorised block, full width */}
        <div className="border-t border-border pt-6">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Authorised Signature
          </p>
          <div className="flex min-h-16 w-48 items-end border-b border-border pb-2">
            {signatureReady && profile?.signatureType === "type" && profile.signatureTextValue ? (
              <span
                className="text-3xl italic text-card-foreground"
                style={{
                  fontFamily:
                    profile.signatureFontFamily === "great-vibes"
                      ? '"Great Vibes", cursive'
                      : profile.signatureFontFamily === "pacifico"
                        ? '"Pacifico", cursive'
                        : profile.signatureFontFamily === "satisfy"
                          ? '"Satisfy", cursive'
                          : '"Dancing Script", cursive',
                }}
              >
                {profile.signatureTextValue}
              </span>
            ) : signatureReady && profile?.signatureImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.signatureImageUrl}
                alt="Authorised signature"
                className="max-h-14 object-contain dark:invert"
              />
            ) : (
              <span className="text-sm italic text-muted-foreground">Awaiting signature setup</span>
            )}
          </div>
          <p className="mt-2 text-[11px] font-medium text-card-foreground">{businessName}</p>
          {signatureReady && (
            <p className="text-[10px] text-muted-foreground">For and on behalf of {businessName}</p>
          )}
        </div>

        {/* Notes + terms */}
        {(values.notes || values.terms) && (
          <div className="mt-6 grid grid-cols-2 gap-6 border-t border-border pt-6 text-[11px]">
            {values.notes && (
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Notes
                </p>
                <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                  {values.notes}
                </p>
              </div>
            )}
            {values.terms && (
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Terms
                </p>
                <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                  {values.terms}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bottom accent rule */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1"
          style={{ backgroundColor: accent }}
        />
      </div>
    </div>
  );
}
