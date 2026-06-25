"use client";

import * as React from "react";
import Link from "next/link";
import { Info, X } from "lucide-react";

/**
 * Dismissible compliance reminder for international (export) work. Plain
 * guidance only — not printed on the document and not legal/tax advice.
 * Dismissal is remembered per-variant in localStorage so it shows once.
 */
type Variant = "invoice" | "contract";

const KEY: Record<Variant, string> = {
  invoice: "stackivo:intl-invoice-note:dismissed",
  contract: "stackivo:intl-contract-note:dismissed",
};

const CONTENT: Record<Variant, { title: string; bullets: React.ReactNode[] }> = {
  invoice: {
    title: "Exporting services? A quick compliance checklist.",
    bullets: [
      <>
        If you&rsquo;re GST-registered, file your <strong>LUT</strong> before issuing
        zero-rated export invoices (otherwise pay IGST and claim a refund).
      </>,
      <>
        Receive payment in <strong>convertible foreign exchange</strong> through your
        bank within ~9 months, and keep your <strong>FIRC / eBRC</strong> with the
        correct purpose code.
      </>,
      <>
        Stackivo doesn&rsquo;t collect payments — your client pays you directly on the
        method shown on the invoice.
      </>,
    ],
  },
  contract: {
    title: "Contracting with an overseas client? A few things to check.",
    bullets: [
      <>
        Your contract includes a <strong>Governing law &amp; jurisdiction</strong> clause
        that defaults to India — review or change the jurisdiction with your client.
      </>,
      <>
        Electronic signatures are binding under the <strong>IT Act 2000</strong> (and
        ESIGN / UETA, eIDAS); your signed PDF keeps a tamper-evident audit trail.
      </>,
      <>
        Stackivo is only the document &amp; signing platform — not a party to your
        agreement and not a payment processor.
      </>,
    ],
  },
};

export function InternationalComplianceNote({
  variant = "invoice",
}: {
  variant?: Variant;
}) {
  const [hidden, setHidden] = React.useState(true);
  const content = CONTENT[variant];

  React.useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(KEY[variant]) === "1");
    } catch {
      setHidden(false);
    }
  }, [variant]);

  if (hidden) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(KEY[variant], "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          {content.title}
        </p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-amber-900/80 dark:text-amber-200/80">
          {content.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
        <Link
          href="/help"
          className="mt-2 inline-block text-[13px] font-medium text-amber-700 underline underline-offset-2 dark:text-amber-300"
        >
          Learn more in Help &rarr;
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="rounded p-1 text-amber-700/70 transition-colors hover:bg-amber-500/10 hover:text-amber-900 dark:text-amber-300/70 dark:hover:text-amber-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
