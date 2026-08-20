import { FileSignature, Receipt, Timer, UserRound, Wallet } from "lucide-react";
import { Section, SectionHeading } from "../section";
import { Reveal } from "../motion";

const STEPS = [
  { icon: UserRound, title: "Client", detail: "Nexa Labs", meta: "One shared record" },
  { icon: FileSignature, title: "Contract", detail: "Signed", meta: "Scope locked" },
  { icon: Timer, title: "Work", detail: "18.5 hours", meta: "Time recorded" },
  { icon: Receipt, title: "Invoice", detail: "₹99,120", meta: "IGST included" },
  { icon: Wallet, title: "Payment", detail: "Matched", meta: "Books updated" },
];

export function ConnectedWorkflowSection() {
  return (
    <Section id="workflow" size="wide" className="border-y border-border bg-accent/25">
      <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
        <Reveal>
          <SectionHeading eyebrow="The Flowline" title="One client. One connected trail." />
        </Reveal>
        <Reveal delay={0.06}>
          <p className="max-w-[62ch] text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Every handoff between apps loses context. Stackivo keeps the trail intact: the
            signed scope informs the work, the work becomes the invoice, and the payment
            closes the loop without copying a number between tabs.
          </p>
        </Reveal>
      </div>

      <div className="relative mt-14 grid gap-0 md:grid-cols-5">
        <span aria-hidden className="absolute bottom-6 left-[10%] top-6 hidden border-t border-dashed border-primary/35 md:block md:w-[80%]" />
        <span aria-hidden className="absolute bottom-10 left-5 top-10 border-l border-dashed border-primary/35 md:hidden" />
        {STEPS.map((step, index) => (
          <Reveal key={step.title} delay={index * 0.045}>
            <article className="relative grid grid-cols-[40px_1fr] gap-4 border-b border-border py-6 last:border-b-0 md:block md:border-b-0 md:px-4 md:py-0 md:text-center">
              <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/25 bg-card text-primary shadow-[0_8px_24px_-16px_hsl(var(--primary)/0.6)] md:mx-auto">
                <step.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="font-mono text-micro uppercase tracking-[0.14em] text-primary md:mt-5">0{index + 1} · {step.title}</p>
                <p className="mt-1 font-display text-lg font-semibold tracking-[-0.035em] text-foreground">{step.detail}</p>
                <p className="mt-1 text-xs text-muted-foreground">{step.meta}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
