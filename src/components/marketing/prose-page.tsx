import * as React from "react";
import { Section } from "./section";
import { LegalToc } from "./legal-toc";

/**
 * Small reusable shell for legal / about / contact-style prose pages.
 * Centred, narrow column, consistent vertical rhythm across all
 * non-product marketing surfaces.
 *
 * Pass `toc` to opt in to the wider layout with a sticky, auto-generated
 * table of contents on the left (used for the long-form legal documents —
 * privacy, terms, refund policy, security). Pages that don't pass it keep
 * the original narrow single-column look untouched.
 */
export function ProsePage({
  title,
  lead,
  eyebrow,
  badge,
  toc = false,
  children,
}: {
  title: string;
  lead?: React.ReactNode;
  /** Optional small metadata block rendered ABOVE the H1
   *  (e.g. blog category + reading time + date). */
  eyebrow?: React.ReactNode;
  /** Optional small pill rendered above the H1 — e.g. "Updated 1 Jan 2026". */
  badge?: React.ReactNode;
  /** Render a sticky auto-generated table of contents beside the prose. */
  toc?: boolean;
  children: React.ReactNode;
}) {
  // Static id is safe here: ProsePage renders once per page, and this
  // component is a Server Component (no hooks allowed) — only LegalToc,
  // which reads this id back out of the DOM, is a Client Component.
  const contentId = "legal-prose-content";

  const prose = (
    <div>
      {eyebrow ? <div className="mb-4">{eyebrow}</div> : null}
      {badge ? <div className="mb-4">{badge}</div> : null}
      <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
        {title}
      </h1>
      {lead ? (
        <p className="mt-4 text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          {lead}
        </p>
      ) : null}
      <div
        id={contentId}
        className="prose-stackivo mt-10 space-y-6 text-sm leading-7 text-foreground [&_h2]:scroll-mt-24 [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2:first-child]:mt-0 [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wider [&_h3]:text-muted-foreground [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-muted-foreground [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:text-muted-foreground [&_li]:my-1 [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:opacity-80"
      >
        {children}
      </div>
    </div>
  );

  if (!toc) {
    return (
      <Section size="default" className="pb-16 pt-12 sm:pt-16 lg:pb-20 lg:pt-20">
        <div className="mx-auto max-w-3xl">{prose}</div>
      </Section>
    );
  }

  return (
    <Section size="wide" className="pb-16 pt-12 sm:pt-16 lg:pb-20 lg:pt-20">
      {/*
        Deliberately NOT `items-start` here. Grid items default to
        `stretch`, so the <aside> cell stretches to match the height of
        the (much taller) prose column. That gives the `sticky` element
        inside LegalToc room to travel as the page scrolls instead of
        being trapped inside a box that's already only as tall as its
        own short content.
      */}
      <div className="mx-auto max-w-5xl lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
        <LegalToc contentId={contentId} />
        <div className="max-w-3xl">{prose}</div>
      </div>
    </Section>
  );
}
