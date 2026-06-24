import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import type { InvoiceTotals } from "../../schema";

interface InvoiceTotalsProps {
  totals: InvoiceTotals;
  gstRate: number;
  taxMode: "intra" | "inter";
  currency?: string;
  /** When true, uses a larger "document" style (used in the paper preview). */
  variant?: "compact" | "document";
  className?: string;
}

/**
 * Reusable totals breakdown. Used by both the sticky summary card and the
 * paper-style invoice preview — the `variant` prop adjusts density + weight
 * without duplicating the math.
 */
export function InvoiceTotalsBreakdown({
  totals,
  gstRate,
  taxMode,
  currency = "INR",
  variant = "compact",
  className,
}: InvoiceTotalsProps) {
  const labelClass =
    variant === "document"
      ? "text-sm text-muted-foreground"
      : "text-sm text-muted-foreground";
  const valueClass =
    variant === "document"
      ? "text-sm tabular-nums"
      : "text-sm tabular-nums";
  const halfRate = (gstRate / 2).toFixed(gstRate % 2 === 0 ? 0 : 1);

  return (
    <div className={cn("space-y-2", className)}>
      <Row label="Subtotal" value={formatMoney(totals.subtotal, currency)} labelClass={labelClass} valueClass={valueClass} />

      {totals.discount > 0 && (
        <Row
          label="Discount"
          value={`−${formatMoney(totals.discount, currency)}`}
          labelClass={labelClass}
          valueClass={cn(valueClass, "text-warning")}
        />
      )}

      {taxMode === "intra" && gstRate > 0 && (
        <>
          <Row
            label={`CGST (${halfRate}%)`}
            value={formatMoney(totals.cgst, currency)}
            labelClass={labelClass}
            valueClass={valueClass}
          />
          <Row
            label={`SGST (${halfRate}%)`}
            value={formatMoney(totals.sgst, currency)}
            labelClass={labelClass}
            valueClass={valueClass}
          />
        </>
      )}

      {taxMode === "inter" && gstRate > 0 && (
        <Row
          label={`IGST (${gstRate}%)`}
          value={formatMoney(totals.igst, currency)}
          labelClass={labelClass}
          valueClass={valueClass}
        />
      )}

      <div
        className={cn(
          "flex items-baseline justify-between border-t pt-3",
          variant === "document" ? "pt-4" : "pt-3",
        )}
      >
        <span
          className={
            variant === "document"
              ? "text-sm font-semibold uppercase tracking-wider"
              : "text-sm font-semibold"
          }
        >
          Total
        </span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            variant === "document" ? "text-xl" : "text-lg",
          )}
        >
          {formatMoney(totals.total, currency)}
        </span>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  labelClass,
  valueClass,
}: {
  label: string;
  value: string;
  labelClass: string;
  valueClass: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={labelClass}>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}
