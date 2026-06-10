import { ArrowDown, Check } from "lucide-react";
import { StackivoMark } from "@/components/brand/stackivo-logo";
import { Section, SectionHeading } from "../section";
import { Reveal, StaggerItem, StaggerReveal } from "../motion";

/**
 * Problem → solution. The visitor should recognise their own messy stack in
 * the scattered chips, then see it collapse into one Stackivo card.
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
    <Section className="py-20 sm:py-24 lg:py-28">
      <Reveal>
        <SectionHeading
          eyebrow="The problem"
          title="Your business is scattered across six apps."
          subtitle="Every handoff between tools is a place where an invoice goes unsent, a follow-up gets forgotten, and unbilled hours quietly disappear."
        />
      </Reveal>

      <div className="mx-auto mt-14 flex max-w-2xl flex-col items-center">
        {/* Scattered stack */}
        <StaggerReveal className="flex flex-wrap items-center justify-center gap-3">
          {SCATTERED.map((item) => (
            <StaggerItem key={item.label} className={item.rotate}>
              <span className="inline-block rounded-xl border border-dashed border-border bg-muted/50 px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm">
                {item.label}
              </span>
            </StaggerItem>
          ))}
        </StaggerReveal>

        <Reveal delay={0.25} className="my-8 flex flex-col items-center gap-1">
          <ArrowDown className="h-5 w-5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            becomes
          </span>
        </Reveal>

        {/* Resolved card */}
        <Reveal delay={0.3} className="w-full">
          <div className="relative overflow-hidden rounded-3xl border border-primary/15 bg-card p-7 shadow-xl shadow-primary/[0.07] sm:p-9">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/[0.07] blur-2xl"
            />
            <div className="flex items-center gap-3">
              <StackivoMark className="h-10 w-10 rounded-xl" />
              <div>
                <p className="font-display text-lg font-semibold tracking-tight text-foreground">
                  One workspace
                </p>
                <p className="text-sm text-muted-foreground">
                  Everything about a client, in one tab
                </p>
              </div>
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
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
