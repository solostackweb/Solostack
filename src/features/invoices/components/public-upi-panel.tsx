"use client";

/**
 * Public-page UPI panel rendered when the freelancer's `payment_method_type`
 * is `upi_manual`.
 *
 * No payment SDK runs here — Stackivo doesn't see the money. We just
 * render the QR + the copyable VPA and a clear "the freelancer will
 * confirm once received" notice. The freelancer flips the invoice to
 * `paid` from their dashboard which generates the receipt.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { IntegrationLogo } from "@/components/integrations/integration-logo";
import { Check, Copy, QrCode, Smartphone } from "lucide-react";

interface Props {
  qrSvg: string;
  vpa: string;
  amountFormatted: string;
  invoiceNumber: string;
  upiUri: string;
  alreadyPaid: boolean;
}

export function PublicUpiPanel({
  qrSvg,
  vpa,
  amountFormatted,
  invoiceNumber,
  upiUri,
  alreadyPaid,
}: Props) {
  const [copiedVpa, setCopiedVpa] = React.useState(false);

  if (alreadyPaid) {
    return (
      <div className="rounded-lg border border-success-subtle bg-success-subtle p-5 text-center">
        <Check className="mx-auto mb-2 h-7 w-7 text-success-strong" />
        <p className="text-sm font-semibold text-success-strong">
          This invoice has been paid.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          A receipt has been emailed to you.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-4 space-y-1">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border bg-background">
            <IntegrationLogo id="upi" className="h-4 w-4" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pay invoice {invoiceNumber}
          </p>
        </div>
        <p className="text-2xl font-semibold tracking-tight">
          {amountFormatted}
        </p>
        <p className="text-xs text-muted-foreground">
          Scan with any UPI app — GPay, PhonePe, Paytm, BHIM, etc.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div
          className="flex h-[240px] w-[240px] items-center justify-center rounded-lg bg-white p-2"
          // The SVG comes from `qrcode` on the server. Its width=240 attr
          // is fixed in our helper, so layout is stable.
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <a
          href={upiUri}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline sm:hidden"
        >
          <Smartphone className="h-3.5 w-3.5" />
          Open in UPI app
        </a>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
          Or pay to this UPI ID
        </p>
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <span className="truncate font-mono text-sm">{vpa}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 px-2"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(vpa);
                setCopiedVpa(true);
                setTimeout(() => setCopiedVpa(false), 1800);
              } catch {
                /* clipboard blocked — ignore */
              }
            }}
          >
            {copiedVpa ? (
              <>
                <Check className="mr-1 h-3.5 w-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
        <QrCode className="mr-1.5 inline h-3.5 w-3.5 align-text-top" />
        Once you&apos;ve sent the payment, the freelancer will confirm it
        in their dashboard and email you a receipt. You don&apos;t need to
        do anything else here.
      </div>
    </div>
  );
}
