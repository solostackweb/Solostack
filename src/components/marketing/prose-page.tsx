import * as React from "react";
import { Section } from "./section";

/**
 * Small reusable shell for legal / about / contact-style prose pages.
 * Centred, narrow column, consistent vertical rhythm across all
 * non-product marketing surfaces.
 */
export function ProsePage({
  title,
  lead,
  eyebrow,
  children,
}: {
  title: string;
  lead?: React.ReactNode;
  /** Optional small metadata block rendered ABOVE the H1
   *  (e.g. blog category + reading time + date). */
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Section size="default" className="pb-16 pt-12 sm:pt-16 lg:pb-20 lg:pt-20">
      <div className="mx-auto max-w-3xl">
        {eyebrow ? <div className="mb-4">{eyebrow}</div> : null}
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        {lead ? (
          <p className="mt-4 text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            {lead}
          </p>
        ) : null}
        <div className="prose-stackivo mt-10 space-y-6 text-[15px] leading-7 text-foreground [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2:first-child]:mt-0 [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wider [&_h3]:text-muted-foreground [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-muted-foreground [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:text-muted-foreground [&_li]:my-1 [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:opacity-80">
          {children}
        </div>
      </div>
    </Section>
  );
}
