import * as React from "react";
import Link from "next/link";
import { Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_DOCUMENT_BRAND } from "@/config/brand-colors";

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
 * Premium-minimal recipe: soft neutral canvas, elevated white document
 * card with a slim brand accent bar, sender identity up top, and trust
 * signals in the footer. Mirrors the public invoice page.
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
  const accentColor = accent ?? DEFAULT_DOCUMENT_BRAND;

  return (
    <div className="relative min-h-svh bg-muted/40">
      {/* Soft top wash so the page doesn't feel flat */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background: `linear-gradient(to bottom, ${accentColor}0d, transparent)`,
        }}
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col px-3 py-5 sm:px-6 sm:py-10 lg:py-12">
        {/* Sender identity row — same pattern as the public invoice page */}
        <div className="mb-5 flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={senderName}
              className="h-11 w-11 shrink-0 rounded-lg border bg-background object-contain p-1 shadow-sm"
            />
          ) : (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-base font-bold text-white shadow-sm"
              style={{ backgroundColor: accentColor }}
            >
              {senderName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {senderName}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              shared {eyebrow.toLowerCase().startsWith("invoice") ? "an" : "a"}{" "}
              {eyebrow.toLowerCase()} with you
            </p>
          </div>
        </div>

        <header className="sticky top-0 z-20 -mx-3 mb-5 border-b bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:static sm:mx-0 sm:mb-6 sm:rounded-lg sm:border sm:px-5 sm:py-4 sm:shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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
            <div className="flex shrink-0 items-center gap-2">
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

        <div className="overflow-hidden rounded-2xl border border-black/5 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_32px_-12px_rgba(15,23,42,0.12)]">
          {/* Brand accent bar */}
          <div className="h-1.5 w-full" style={{ backgroundColor: accentColor }} />
          {children}
        </div>

        <footer className="mt-6 flex flex-col items-center gap-2 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p className="inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Secure link · sent by{" "}
            <span className="font-medium text-foreground">{senderName}</span>
          </p>
          <p>
            Powered by{" "}
            <Link
              href="/"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              Stackivo
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
