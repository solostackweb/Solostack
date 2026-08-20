import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { SectionBand } from "../section";
import { Reveal } from "../motion";

export function AiSection() {
  return (
    <SectionBand id="ai" size="wide" className="overflow-hidden">
      <div className="grid items-center gap-12 lg:grid-cols-[.82fr_1.18fr] lg:gap-20">
        <Reveal>
          <div className="max-w-xl">
            <p className="font-mono text-micro font-medium uppercase tracking-[0.14em] text-background/70">
              Ivo · inside your workspace
            </p>
            <h2 className="mt-6 text-balance font-display text-4xl font-semibold tracking-[-0.045em] text-background sm:text-5xl">
              An assistant with the missing context already attached.
            </h2>
            <p className="mt-6 text-base leading-7 text-background/70 sm:text-lg sm:leading-8">
              Ivo can see the client, invoice state and project history you are looking at.
              It drafts the next action from that context instead of asking you to paste the
              story into another chat window.
            </p>
            <Link
              href="/signup"
              data-cta="ai_section"
              className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold text-background"
            >
              Put Ivo to work
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="overflow-hidden rounded-2xl border border-background/15 bg-card shadow-[0_32px_80px_-34px_hsl(220_80%_2%/0.7)]" aria-hidden>
            <div className="flex items-center gap-3 border-b border-border bg-muted/45 px-5 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold text-foreground">Ivo</p>
                <p className="text-micro text-muted-foreground">Viewing Karta Studio · INV-0041</p>
              </div>
              <span className="ml-auto rounded-full bg-success-subtle px-2.5 py-1 text-micro font-semibold text-success-strong">
                Workspace connected
              </span>
            </div>
            <div className="space-y-5 p-5 sm:p-7">
              <div className="flex justify-end">
                <p className="max-w-[84%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-xs leading-5 text-primary-foreground">
                  This invoice is 12 days overdue. Draft a polite reminder using the project context.
                </p>
              </div>
              <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-border bg-background p-4">
                <p className="text-xs leading-5 text-foreground">
                  Karta approved the launch files on 16 August. Here is a reminder for
                  <strong> INV-0041 · ₹62,500</strong>:
                </p>
                <div className="mt-3 rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">
                  Hi Meera — glad the launch files are approved. A quick reminder that
                  INV-0041 was due on 8 August. I’ve included the payment link below for convenience.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-lg bg-primary px-3 py-2 text-micro font-semibold text-primary-foreground">Send email</span>
                  <span className="rounded-lg border border-border bg-card px-3 py-2 text-micro font-medium text-foreground">Edit draft</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-4 text-micro text-muted-foreground">
                <span>Used: invoice · client · project timeline</span>
                <span className="font-mono tabular-nums">Drafted in 1.4s</span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </SectionBand>
  );
}
