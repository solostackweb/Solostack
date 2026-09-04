import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProjectWorkspaceMockup } from "./project-workspace-mockup";
import { Section, SectionHeading } from "../section";
import { Reveal } from "../motion";

const PROOF = [
  { label: "Outstanding", value: "₹1,24,847", note: "across 3 invoices" },
  { label: "Unbilled time", value: "38.5 h", note: "ready to invoice" },
  { label: "Next action", value: "2 reminders", note: "drafted by Ivo" },
];

export function ProductSection() {
  return (
    <Section id="product" size="wide">
      <div className="grid items-end gap-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-20">
        <Reveal>
          <SectionHeading
            eyebrow="One operating view"
            title="See the work and the money together."
          />
        </Reveal>
        <Reveal delay={0.06}>
          <div className="max-w-[60ch] lg:ml-auto">
            <p className="text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              A project is not separate from its contract, tracked time, invoice or payment.
              Stackivo keeps every artifact attached to the same client context, so Pulse can
              show what needs attention without another spreadsheet.
            </p>
            <Link href="/demo" className="group mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
              Walk through the workspace
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-12">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_32px_90px_-48px_hsl(224_45%_28%/0.42)]">
          <div className="flex h-11 items-center gap-1.5 border-b border-border bg-muted/45 px-4">
            <span className="h-1.5 w-1.5 rounded-full bg-border" />
            <span className="h-1.5 w-1.5 rounded-full bg-border" />
            <span className="h-1.5 w-1.5 rounded-full bg-border" />
            <span className="ml-2 font-mono text-micro text-muted-foreground">stackivo.me/projects/nexa-website-launch</span>
          </div>
          <ProjectWorkspaceMockup />
        </div>
      </Reveal>

      <div className="mt-8 grid border-y border-border sm:grid-cols-3">
        {PROOF.map((item, index) => (
          <Reveal key={item.label} delay={0.05 * index}>
            <div className="border-b border-border py-6 last:border-b-0 sm:border-b-0 sm:border-r sm:px-7 sm:first:pl-0 sm:last:border-r-0">
              <p className="font-mono text-micro uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
              <p className="mt-2 font-mono text-xl font-medium tracking-[-0.03em] tabular-nums text-foreground">{item.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
