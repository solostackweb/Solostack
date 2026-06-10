import {
  FileSignature,
  FolderKanban,
  HandHeart,
  Receipt,
  UserPlus,
} from "lucide-react";
import { Section, SectionHeading } from "../section";
import { Reveal, StaggerItem, StaggerReveal } from "../motion";

/**
 * Workflow visualization — the actual Stackivo order of operations:
 * client → project → welcome doc → contract → invoice.
 * Horizontal rail on desktop, vertical spine on mobile.
 */
const STEPS = [
  {
    icon: UserPlus,
    title: "Add the client",
    body: "One profile holds their details, GST state, and history.",
    chip: "30 seconds",
  },
  {
    icon: FolderKanban,
    title: "Add the project",
    body: "Set the scope, rate, and timeline. Track time against it from day one.",
    chip: "Timer ready",
  },
  {
    icon: HandHeart,
    title: "Send the welcome doc",
    body: "A polished onboarding doc — process, expectations, payment terms.",
    chip: "Great first impression",
  },
  {
    icon: FileSignature,
    title: "Sign the contract",
    body: "Share a signing link. They e-sign in the browser — no printer involved.",
    chip: "E-signed",
  },
  {
    icon: Receipt,
    title: "Invoice & get paid",
    body: "Billable hours become line items, the invoice carries a payment link, and reminders chase it for you.",
    chip: "₹ in bank",
  },
] as const;

export function WorkflowSection() {
  return (
    <Section id="workflow" size="ultra" className="border-y bg-muted/30">
      <Reveal>
        <SectionHeading
          eyebrow="The workflow"
          title="From hello to paid, without the gaps."
          subtitle="Each step hands off to the next automatically — the project tracks the hours, the hours build the invoice, the payment closes the loop."
        />
      </Reveal>

      <StaggerReveal className="relative mx-auto mt-10 grid max-w-md gap-0 lg:mt-14 lg:max-w-none lg:grid-cols-5 lg:gap-6">
        {/* Connector — horizontal on desktop */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-[27px] top-6 hidden h-px w-auto lg:left-[10%] lg:right-[10%] lg:block lg:bg-gradient-to-r lg:from-primary/10 lg:via-primary/40 lg:to-primary/10"
        />
        {/* Connector — vertical on mobile */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-10 left-[27px] top-6 w-px bg-gradient-to-b from-primary/10 via-primary/40 to-primary/10 lg:hidden"
        />

        {STEPS.map((s, i) => (
          <StaggerItem key={s.title} className="relative">
            <div className="flex gap-5 pb-8 last:pb-0 lg:flex-col lg:gap-0 lg:pb-0 lg:text-center">
              {/* Node */}
              <div className="relative z-10 flex flex-col items-center lg:mx-auto">
                <span className="flex h-[54px] w-[54px] items-center justify-center rounded-2xl border border-primary/20 bg-background text-primary shadow-md shadow-primary/[0.08]">
                  <s.icon className="h-5 w-5" />
                </span>
              </div>

              <div className="flex-1 pt-1 lg:pt-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-primary/70">
                  Step {i + 1}
                </p>
                <h3 className="mt-1 font-display text-base font-semibold tracking-tight text-foreground">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground lg:mx-auto lg:max-w-[210px]">
                  {s.body}
                </p>
                <span className="mt-2.5 inline-block rounded-full bg-primary/[0.07] px-2.5 py-1 text-[10px] font-semibold text-primary">
                  {s.chip}
                </span>
              </div>
            </div>
          </StaggerItem>
        ))}
      </StaggerReveal>
    </Section>
  );
}
