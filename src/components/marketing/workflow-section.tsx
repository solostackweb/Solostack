"use client";

import {
  CheckCircle2,
  CircleDollarSign,
  FileSignature,
  Send,
  Users,
} from "lucide-react";
import { Section, SectionHeading } from "./section";
import { Reveal, StaggerReveal, StaggerItem } from "./motion";

const STEPS = [
  {
    icon: Users,
    title: "Add a client",
    description:
      "Capture GSTIN, billing state, place of supply. We figure out CGST vs IGST so you don't have to.",
  },
  {
    icon: FileSignature,
    title: "Send the proposal",
    description:
      "Draft a contract, share a public signing link, watch the status update in real time.",
  },
  {
    icon: Send,
    title: "Invoice the engagement",
    description:
      "Pull line items from tracked time, apply the right tax mode, send a payment-ready invoice.",
  },
  {
    icon: CircleDollarSign,
    title: "Track the payment",
    description:
      "Mark sent · viewed · paid. Pulse aggregates your cash flow automatically.",
  },
  {
    icon: CheckCircle2,
    title: "Close the loop",
    description:
      "Project marked complete, revenue logged, client primed for the next engagement.",
  },
];

export function WorkflowSection() {
  return (
    <Section id="workflow" size="wide" className="relative border-y bg-muted/30">
      <Reveal>
        <SectionHeading
          eyebrow="The freelancer workflow"
          title="From first hello to final payment — without switching tabs."
          subtitle="Every freelance engagement follows the same arc. Stackivo is the rails underneath."
        />
      </Reveal>

      <div className="relative mt-16 sm:mt-20">
        {/* Static connecting line on lg+ — the entrance animation removed; the
           parent StaggerReveal already supplies the cinematic feel as each
           card fades in beneath the line. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-[10%] right-[10%] top-9 hidden h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent lg:block"
        />
        <StaggerReveal
          className="relative grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-5 lg:gap-4"
          amount={0.15}
        >
          {STEPS.map((s, i) => (
            <StaggerItem key={s.title}>
              <div className="group relative flex h-full flex-col gap-4 rounded-2xl border bg-card p-6 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/[0.04] lg:p-7">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border bg-background text-primary shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:border-primary/40 group-hover:shadow-md">
                    <s.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="font-mono text-micro font-semibold tracking-wider text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold tracking-tight lg:text-lg">
                    {s.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {s.description}
                  </p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerReveal>
      </div>
    </Section>
  );
}
