import * as React from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  /** Pre-formatted heading (e.g. "Invoice INV-0042"). */
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Sender / freelancer attribution, rendered top-right. */
  senderName: string;
  /** Pro branding: logo data-URL (already signed/inlined by the builder). */
  logoUrl?: string | null;
  /** Pro branding: brand accent in #RRGGBB. */
  accent?: string | null;
  /** Status pill content, rendered next to the eyebrow. */
  statusBadge?: React.ReactNode;
  /** PDF download URL. Optional for document types that do not export yet. */
  pdfUrl?: string;
  pdfFileName?: string;
  children: React.ReactNode;
  /** Optional extra CTA in the toolbar (e.g. "Sign now"). */
  primaryAction?: React.ReactNode;
}

/**
 * Visual chrome for shared contracts, proposals, and welcome docs.
 * Mirrors the public invoice page: sender identity row up top (logo or
 * accent-coloured initial), brand accent bar on the document card.
 */
export function PublicDocumentFrame({
  eyebrow,
  title,
  subtitle,
  senderName,
  logoUrl,
  accent,
  statusBadge,
  pdfUrl,
  pdfFileName,
  children,
  primaryAction,
}: Props) {
  const accentColor = accent ?? "#0F172A";

  return (
    <div className="min-h-svh bg-muted/30">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-3 py-4 sm:px-6 sm:py-8 lg:py-10">

        {/* Sender identity row — same pattern as the public invoice page */}
        <div className="mb-4 flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={senderName}
              className="h-10 w-10 shrink-0 rounded-lg border bg-background object-contain p-0.5"
            />
          ) : (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: accentColor }}
            >
              {senderName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{senderName}</p>
            <p className="text-xs text-muted-foreground">
              Shared {eyebrow.toLowerCase().startsWith("invoice") ? "an" : "a"}{" "}
              {eyebrow.toLowerCase()} with you
            </p>
          </div>
        </div>

        <header className="sticky top-0 z-20 -mx-3 mb-4 border-b bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:static sm:mx-0 sm:mb-6 sm:rounded-lg sm:border sm:px-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {eyebrow}
                {statusBadge}
              </div>
              <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {pdfUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={pdfUrl} download={pdfFileName} rel="noopener">
                    <Download className="h-4 w-4" /> Download PDF
                  </a>
                </Button>
              ) : null}
              {primaryAction}
            </div>
          </div>
        </header>

        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {/* Brand accent bar */}
          <div className="h-1.5 w-full" style={{ backgroundColor: accentColor }} />
          {children}
        </div>

        <footer className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
          <p>
            Sent by <span className="text-foreground">{senderName}</span>
          </p>
          <p>
            Powered by{" "}
            <Link
              href="/"
              className={cn(
                "font-medium text-foreground hover:underline",
                "underline-offset-2",
              )}
            >
              Stackivo
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
