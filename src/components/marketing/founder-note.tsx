import Link from "next/link";
import { ArrowRight, MessageCircle, Mail } from "lucide-react";
import { Section } from "./section";
import { Reveal } from "./motion";

/**
 * Founder note block.
 *
 * Solo / small-team SaaS converts ~15-30% better when the marketing
 * site shows a real human is on the other side. This block is the
 * visible "we are here, we read every message" callout — placed
 * between Pulse + Testimonials on the landing page.
 *
 * Copy is intentionally generic-team voice (per founder request).
 * When you're ready to personalise, swap the H3 and the paragraph
 * for first-person founder voice + a photo.
 */
export function FounderNote() {
  return (
    <Section size="default" className="py-16 sm:py-20 lg:py-24">
      <Reveal>
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border bg-card p-7 shadow-sm sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
          />

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
              Built solo · Built in the open
            </span>

            <h3 className="mt-4 text-2xl font-semibold tracking-tight sm:text-[28px]">
              No tier-one queue. The team that built it answers your messages.
            </h3>

            <div className="mt-4 space-y-3 text-[15px] leading-7 text-muted-foreground">
              <p>
                Most freelance SaaS pretends India doesn&rsquo;t exist or
                bolts on GST as an afterthought. Stackivo is built solo from
                India for Indian freelancers &mdash; GST, place-of-supply
                rules, INR pricing and Razorpay payments are first-class
                citizens, not patches.
              </p>
              <p>
                That means:
              </p>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/60" />
                  <span>
                    Every feature ships because <em>you</em> asked for it
                    &mdash; the public roadmap is on the homepage.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/60" />
                  <span>
                    Support replies come from the people who wrote the code.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/60" />
                  <span>
                    Free is genuinely free. 5 clients, every workflow, no
                    feature lock-out.
                  </span>
                </li>
              </ul>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href="/about"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:opacity-80"
              >
                What we believe <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:opacity-80"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Talk to us
              </Link>
              <a
                href="mailto:support@stackivo.me"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:opacity-80"
              >
                <Mail className="h-3.5 w-3.5" />
                support@stackivo.me
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
