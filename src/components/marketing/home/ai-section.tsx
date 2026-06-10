import { ArrowRight, FileText, IndianRupee, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { Section } from "../section";
import { Reveal, StaggerItem, StaggerReveal } from "../motion";

/**
 * Stackivo AI — an assistant that lives inside the workspace and acts on the
 * user's real data, shown as a realistic chat exchange plus quick-action chips.
 */
const QUICK_ACTIONS = [
  { icon: Mail, label: "Draft a payment reminder" },
  { icon: FileText, label: "Summarise this project" },
  { icon: IndianRupee, label: "Who owes me money?" },
];

export function AiSection() {
  return (
    <Section id="ai" size="ultra">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Copy */}
        <Reveal>
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary">
              <Sparkles className="h-3 w-3" />
              Stackivo AI
            </p>
            <h2 className="mt-4 text-balance font-display text-[28px] font-semibold tracking-tight sm:text-[36px] lg:text-[42px] lg:tracking-[-0.018em]">
              An assistant that knows your business, not just words.
            </h2>
            <p className="mt-4 text-pretty text-base leading-[1.75] text-muted-foreground sm:text-[17px]">
              Stackivo AI works inside your workspace — your clients, invoices,
              and projects — so it answers with your numbers and drafts in your
              voice. Ask it to chase an overdue invoice, summarise a project for
              a client update, or tell you who your most profitable client is.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Drafts reminders, updates, and welcome docs in seconds",
                "Answers questions from your real revenue and time data",
                "Flags overdue invoices and stalled projects before you ask",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-[15px] text-foreground/90">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-3 w-3" />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              data-cta="ai_section"
              className="group mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
            >
              Meet your new back office
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Reveal>

        {/* Chat mockup */}
        <Reveal delay={0.1}>
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-8 -z-10 rounded-[3rem] bg-gradient-to-br from-primary/[0.10] via-primary/[0.04] to-transparent blur-2xl"
            />
            <div className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xl shadow-primary/[0.08]" aria-hidden>
              <div className="flex items-center gap-2.5 border-b border-border/70 bg-muted/40 px-5 py-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <span className="text-[13px] font-semibold text-foreground">Stackivo AI</span>
                <span className="ml-auto rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                  Connected to your workspace
                </span>
              </div>

              <div className="space-y-4 p-5 sm:p-6">
                {/* User message */}
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[13px] leading-relaxed text-primary-foreground">
                    Karta Studio&rsquo;s invoice is 12 days overdue. Draft a polite reminder.
                  </p>
                </div>

                {/* AI reply */}
                <div className="flex justify-start">
                  <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-border/70 bg-background px-4 py-3.5">
                    <p className="text-[13px] leading-relaxed text-foreground">
                      Here&rsquo;s a draft for <span className="font-semibold">INV-0041 (₹62,500)</span>:
                    </p>
                    <div className="mt-2.5 rounded-xl bg-muted/60 p-3 text-[12px] leading-relaxed text-muted-foreground">
                      Hi Meera — hope the launch went well! A gentle nudge that
                      invoice INV-0041 (₹62,500) was due on 29 May. The payment
                      link is below whenever convenient. Thanks!
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground">
                        Send via email
                      </span>
                      <span className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-foreground">
                        Share on WhatsApp
                      </span>
                      <span className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-foreground">
                        Edit draft
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick actions */}
                <StaggerReveal className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
                  {QUICK_ACTIONS.map((a) => (
                    <StaggerItem key={a.label}>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                        <a.icon className="h-3 w-3 text-primary" />
                        {a.label}
                      </span>
                    </StaggerItem>
                  ))}
                </StaggerReveal>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
