"use client";

import { CheckCircle2 } from "lucide-react";
import { Section, SectionHeading } from "./section";
import { InvoiceMockup } from "./invoice-mockup";
import { Reveal, StaggerReveal, StaggerItem } from "./motion";

const POINTS = [
  {
    title: "Auto-detect tax mode",
    description:
      "Same state → CGST + SGST. Different state → IGST. Non-GST? Standard invoice with the right footer.",
  },
  {
    title: "GSTIN-validated clients",
    description:
      "We verify GSTIN format + state code at entry. Bad numbers never make it onto your invoices.",
  },
  {
    title: "Place-of-supply aware",
    description:
      "Intra-state vs inter-state is computed automatically. Audit-ready, zero spreadsheet maths.",
  },
  {
    title: "Compliant footer notes",
    description:
      "Standard / B2C / B2B classification with the right disclosure footer baked in.",
  },
];

export function GstSection() {
  return (
    <Section id="gst" size="wide">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 xl:gap-24">
        <Reveal className="max-w-xl">
          <SectionHeading
            align="left"
            eyebrow="GST done right"
            title="GST-ready invoicing, without the headache."
            subtitle="Built for Indian freelancers. Whether you're GST-registered or not, your invoices come out compliant on the first try."
          />
          <StaggerReveal className="mt-10 space-y-5" amount={0.25}>
            {POINTS.map((p) => (
              <StaggerItem key={p.title}>
                <div className="flex gap-4 transition-transform duration-200 ease-out hover:translate-x-1">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success-strong">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-base font-medium">{p.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground lg:text-sm">
                      {p.description}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerReveal>
        </Reveal>

        <Reveal className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/15 via-transparent to-primary/10 blur-2xl"
          />
          <div className="transition-transform duration-300 ease-out hover:-translate-y-1">
            <InvoiceMockup />
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
