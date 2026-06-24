"use client";

/**
 * Public invoice — international payment options the freelancer has connected.
 * Link platforms render as a "Pay with X" button; handle platforms show the
 * detail with a copy button + the freelancer's instructions. Display only —
 * payment happens on the platform; the freelancer marks the invoice paid.
 */

import * as React from "react";
import { toast } from "sonner";
import { ExternalLink, Copy, Check } from "lucide-react";
import { providerName, type PaymentConnection } from "@/features/payments/providers";

export function PublicPayOptions({
  connections,
}: {
  connections: PaymentConnection[];
}) {
  const [copied, setCopied] = React.useState<string | null>(null);
  if (!connections.length) return null;

  const copy = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Couldn't copy — please copy manually.");
    }
  };

  return (
    <div className="mx-5 mb-6 rounded-xl border border-slate-200 bg-white p-4 sm:mx-8">
      <p className="text-sm font-semibold text-slate-900">Pay internationally</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Choose a method below. Payment goes directly to the sender.
      </p>
      <div className="mt-3 space-y-2.5">
        {connections.map((c) => {
          const name = c.label || providerName(c.provider);
          if (c.kind === "link") {
            return (
              <div key={c.id}>
                <a
                  href={c.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Pay with {name}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                {c.instructions ? (
                  <p className="mt-1 text-[11px] text-slate-500">{c.instructions}</p>
                ) : null}
              </div>
            );
          }
          return (
            <div key={c.id} className="rounded-lg border border-slate-200 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700">{name}</p>
                  <p className="truncate text-sm text-slate-900">{c.value}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copy(c.id, c.value)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  {copied === c.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied === c.id ? "Copied" : "Copy"}
                </button>
              </div>
              {c.instructions ? (
                <p className="mt-1 text-[11px] text-slate-500">{c.instructions}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
