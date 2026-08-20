import * as React from "react";
import { Download, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BillingPayment } from "../types";

interface Props {
  payments: BillingPayment[];
}

export function PaymentHistory({ payments }: Props) {
  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
        <Receipt className="h-6 w-6 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">No payments yet</p>
        <p className="text-xs text-muted-foreground">
          Receipts will appear here after your first successful charge.
        </p>
      </div>
    );
  }

  return (
    <div className="-my-2 divide-y">
      {payments.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between gap-3 py-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{formatDate(p.createdAt)}</p>
            <p className="text-xs text-muted-foreground">
              {p.method ? `${p.method.toUpperCase()}` : "Payment"}
              {p.cardLast4 ? ` · ···· ${p.cardLast4}` : ""}
              {" · "}
              <span className="font-mono text-xs">
                {p.paymentId.slice(0, 14)}…
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium tabular-nums">
              {formatCurrency(p.amount, p.currency)}
            </span>
            <StatusBadge status={p.status} />
            {p.receiptUrl ? (
              <a
                href={p.receiptUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Open receipt"
              >
                <Download className="h-4 w-4" />
              </a>
            ) : p.invoiceId ? (
              <span className="text-xs text-muted-foreground">
                Receipt pending
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "captured"
      ? "bg-success/10 text-success"
      : status === "failed"
        ? "bg-destructive/10 text-destructive"
        : status === "refunded"
          ? "bg-muted text-muted-foreground"
          : "bg-warning/10 text-warning";
  return (
    <Badge
      variant="secondary"
      className={cn("h-5 px-1.5 text-xs capitalize", tone)}
    >
      {status === "captured" ? "Paid" : status}
    </Badge>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(paise: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}
