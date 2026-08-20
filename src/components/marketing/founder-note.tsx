import Link from "next/link";
import { ArrowRight, MessageCircle, Mail } from "lucide-react";
import { Section, SectionEyebrow } from "./section";
import { Reveal } from "./motion";

/** Honest founder context until Stackivo has named, verifiable customer proof. */
export function FounderNote() {
  return (
    <Section size="default" rule>
      <Reveal>
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
          <div>
            <SectionEyebrow>Who is behind it</SectionEyebrow>
            <h2 className="mt-6 text-balance font-display text-3xl font-semibold leading-[1.08] tracking-[-0.045em] text-foreground sm:text-4xl">
              Built here, for the way independents work here.
            </h2>
          </div>

          <div className="max-w-[62ch]">
            <div className="space-y-5 text-base leading-[1.75] text-foreground">
              <p>
                Most freelance software pretends India doesn&rsquo;t exist, or
                bolts GST on as an afterthought. Stackivo is built here, for
                people working here. Place-of-supply rules, INR pricing and
                Razorpay are first-class parts of the product, not patches over
                something designed for somewhere else.
              </p>
              <p>
                It is early. There is no support tier and no ticket queue —
                messages reach the person who wrote the code, and features ship
                because someone asked for them. The roadmap is public and the
                changelog is honest about what is not finished yet.
              </p>
              <p>
                Free is genuinely free: five clients, every workflow, nothing
                locked behind an upgrade prompt. If Stackivo is useful you will
                know before you are asked to pay for it.
              </p>
            </div>

            <div className="mt-8 border-t border-border pt-6">
              <p className="font-mono text-micro uppercase tracking-[0.16em] text-muted-foreground">
                Stackivo · Indore, Madhya Pradesh
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm font-medium">
                <Link
                  href="/about"
                  className="group inline-flex items-center gap-1.5 border-b border-foreground pb-0.5 text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  What we believe
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                  Talk to us
                </Link>
                <a
                  href="mailto:support@stackivo.me"
                  className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  support@stackivo.me
                </a>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
