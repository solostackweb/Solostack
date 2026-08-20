"use client";

import * as React from "react";
import { Trash2, GripVertical } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { computeItemAmount } from "../../schema";
import type { InvoiceFormValues } from "../../schema";

interface InvoiceItemRowProps {
  index: number;
  canRemove: boolean;
  onRemove: () => void;
  currency?: string;
}

/**
 * Line-item row. Reads/writes against the parent RHF context via
 * `{...register}`. The derived `amount` updates via `useWatch` so it
 * recomputes without re-rendering siblings.
 *
 * Layout:
 *
 *   - Mobile (< sm): two-row stack. Description spans full width on its
 *     own row; quantity, rate, computed amount, and delete sit on a
 *     second row. This stops large currency values from colliding with
 *     adjacent fields on narrow viewports.
 *
 *   - sm+: single-row table grid with stable column widths. The amount
 *     cell gets enough room for ten-digit values + currency prefix
 *     (e.g. INR 12,34,56,789.00) without truncation, and falls back to
 *     compact notation when the value still does not fit.
 *
 * Inputs use `min-w-0` on their grid cells so the grid can actually
 * shrink them (the default min-width: auto on grid items is the usual
 * cause of overflow in this kind of layout).
 */
export function InvoiceItemRow({
  index,
  canRemove,
  onRemove,
  currency = "INR",
}: InvoiceItemRowProps) {
  const {
    register,
    formState: { errors },
    control,
  } = useFormContext<InvoiceFormValues>();

  const item = useWatch({ control, name: `items.${index}` });
  const amount = item
    ? computeItemAmount({ quantity: item.quantity, rate: item.rate })
    : 0;

  const itemErrors = errors.items?.[index];
  const isHugeAmount = amount >= 10_000_000;
  const displayAmount = isHugeAmount
    ? formatMoney(amount, currency)
    : formatMoney(amount, currency);
  const exactAmount = formatMoney(amount, currency);

  return (
    <div className="group grid grid-cols-12 items-start gap-x-2 gap-y-2 border-b px-3 py-2.5 last:border-b-0 hover:bg-muted/30">
      <div className="col-span-1 hidden h-9 items-center justify-center text-muted-foreground sm:flex">
        <GripVertical className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="col-span-12 min-w-0 sm:col-span-4">
        <Input
          {...register(`items.${index}.description`)}
          placeholder="Describe the work or deliverable…"
          className={cn(
            "h-9 border-transparent bg-transparent shadow-none focus-visible:border-input focus-visible:bg-background",
            itemErrors?.description && "border-destructive/60",
          )}
          aria-invalid={!!itemErrors?.description}
        />
        {itemErrors?.description?.message && (
          <p className="mt-1 text-xs text-destructive">
            {itemErrors.description.message}
          </p>
        )}
      </div>

      <div className="col-span-3 min-w-0 sm:col-span-2">
        <Input
          {...register(`items.${index}.quantity`)}
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          aria-label="Quantity"
          className={cn(
            "h-9 w-full border-transparent bg-transparent text-right tabular-nums shadow-none focus-visible:border-input focus-visible:bg-background",
            itemErrors?.quantity && "border-destructive/60",
          )}
          aria-invalid={!!itemErrors?.quantity}
        />
      </div>

      <div className="col-span-4 min-w-0 sm:col-span-2">
        <Input
          {...register(`items.${index}.rate`)}
          type="number"
          step="1"
          min="0"
          inputMode="decimal"
          aria-label="Rate"
          className={cn(
            "h-9 w-full border-transparent bg-transparent text-right tabular-nums shadow-none focus-visible:border-input focus-visible:bg-background",
            itemErrors?.rate && "border-destructive/60",
          )}
          aria-invalid={!!itemErrors?.rate}
        />
      </div>

      <div
        className="col-span-4 flex h-9 min-w-0 items-center justify-end pr-1 text-sm font-medium tabular-nums sm:col-span-2"
        title={isHugeAmount ? exactAmount : undefined}
      >
        <span className="block truncate">{displayAmount}</span>
      </div>

      <div className="col-span-1 flex h-9 items-center justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive disabled:opacity-20"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Remove line item"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function InvoiceItemsHeader() {
  return (
    <div className="hidden grid-cols-12 items-center gap-2 border-b bg-muted/30 px-3 py-2 text-micro font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
      <div className="col-span-1" />
      <div className="col-span-4">Description</div>
      <div className="col-span-2 text-right">Qty</div>
      <div className="col-span-2 text-right">Rate</div>
      <div className="col-span-2 text-right">Amount</div>
      <div className="col-span-1" />
    </div>
  );
}
