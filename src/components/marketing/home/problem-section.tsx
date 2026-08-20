import { ArrowDown, ArrowRight, Check } from "lucide-react";
import { StackivoMark } from "@/components/brand/stackivo-logo";
import { Section, SectionHeading } from "../section";
import { Reveal, StaggerItem, StaggerReveal } from "../motion";

/**
 * Problem → solution, laid out horizontally: the scattered stack on the
 * left collapses (→) into one Stackivo card on the right. Stacks vertically
 * with a down arrow on mobile.
 */
const SCATTERED = [
  { label: "Invoices in Excel", rotate: "-rotate-2" },
  { label: "Follow-ups on WhatsApp", rotate: "rotate-1" },
  { label: "Contracts in Word", rotate: "-rotate-1" },
  { label: "Hours in a notes app", rotate: "rotate-2" },
  { label: "Payments in your bank app", rotate: "-rotate-2" },
  { label: "Files lost in email threads", rotate: "rotate-1" },
];

const RESOLVED = [
  "One workspace for every client",
  "Invoices that chase themselves",
  "Contracts signed in the browser",
  "Hours that turn into line items",
];

export function ProblemSection() {
  return (
    <Section size="ultra">
      <Reveal>
        <SectionHeading
          eyebrow="The problem"
          title="Your business is scattered across six apps."
          subtitle="Every handoff between tools is a place where an invoice goes unsent, a follow-up gets forgotten, and unbilled hours quietly disappear."
        />
      </Reveal>

      <div className="mt-10 grid items-center gap-6 lg:mt-12 lg:grid-cols-[1.1fr_auto_1fr] lg:gap-10">
        {/* Scattered stack — left */}
        <StaggerReveal className="flex flex-wrap items-center justify-center gap-3 lg:justify-end">
          {SCATTERED.map((item) => (
            <StaggerItem key={item.label} className={item.rotate}>
              <span className="inline-block rounded-lg border border-dashed border-border bg-muted/50 px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm">
                {item.label}
              </span>
            </StaggerItem>
          ))}
        </StaggerReveal>

        {/* Arrow — center */}
        <Reveal delay={0.2} className="flex flex-col items-center gap-1 lg:px-2">
          <ArrowDown className="h-5 w-5 text-primary lg:hidden" />
          <ArrowRight className="hidden h-6 w-6 text-primary lg:block" />
          <span className="text-micro font-semibold uppercase tracking-widest text-primary">
            becomes
          </span>
        </Reveal>

        {/* Resolved card — right */}
        <Reveal delay={0.25}>
          <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-card p-6 shadow-xl shadow-primary/[0.07] sm:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/[0.07] blur-2xl"
            />
            <div className="flex items-center gap-3">
              <StackivoMark className="h-10 w-10 rounded-lg" />
              <div>
                <p className="font-display text-lg font-semibold tracking-tight text-foreground">
                  One workspace
                </p>
                <p className="text-sm text-muted-foreground">
                  Everything about a client, in one tab
                </p>
              </div>
            </div>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {RESOLVED.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-foreground">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
