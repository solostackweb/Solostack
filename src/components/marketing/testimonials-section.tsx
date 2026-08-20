import Link from "next/link";
import { Sparkles, ArrowRight, Quote } from "lucide-react";
import { Section, SectionHeading } from "./section";
import { Reveal } from "./motion";

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  location: string;
  initial: string;
  accentClass: string;
}

/**
 * Social proof section.
 *
 * TESTIMONIALS array holds early-access quotes from real freelancers.
 * To add a new testimonial, push an entry to the array below.
 * Fields: quote, name, role, location, initial (avatar letter), accentClass.
 */
const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I used to spend 30 minutes per invoice between Excel, WhatsApp, and manually tracking who's paid. Stackivo cut that to under 5 minutes. The WhatsApp share button alone is worth it.",
    name: "Priya Menon",
    role: "UI/UX Designer",
    location: "Bengaluru",
    initial: "P",
    accentClass: "bg-primary/10 text-primary dark:text-primary",
  },
  {
    quote:
      "GST was the thing I dreaded most as a consultant. I kept second-guessing CGST vs IGST for different clients. Stackivo handles it automatically — I just pick the client and it figures out the tax.",
    name: "Rahul Sharma",
    role: "Fullstack Developer",
    location: "Pune",
    initial: "R",
    accentClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    quote:
      "I switched from FreshBooks mainly because it was way overkill for what I do. Stackivo is lean — clients, invoices, get paid. No learning curve. Had my first invoice out in 10 minutes.",
    name: "Divya Krishnan",
    role: "Brand Strategist",
    location: "Chennai",
    initial: "D",
    accentClass: "bg-success-subtle text-success-strong",
  },
];

export function TestimonialsSection() {
  return (
    <Section size="wide" className="relative border-y bg-muted/30">
      <Reveal>
        <SectionHeading
          eyebrow="Early access"
          title="Freelancers who switched to Stackivo."
          subtitle="A small but growing group of independent professionals who traded spreadsheets and juggling multiple tools for one clean workspace."
        />
      </Reveal>

      {/* Testimonial cards */}
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={t.name} style={{ transitionDelay: `${i * 80}ms` }}>
            <div className="flex h-full flex-col rounded-2xl border bg-card p-6">
              <Quote className="h-5 w-5 shrink-0 text-muted-foreground/40" />
              <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-5 flex items-center gap-3 border-t pt-4">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${t.accentClass}`}
                >
                  {t.initial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.role} · {t.location}
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Founder availability card */}
      <Reveal className="mx-auto mt-8 max-w-2xl">
        <div className="relative overflow-hidden rounded-2xl border bg-card p-7 sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Building in public
            </span>
            <h3 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
              We answer support ourselves. We ship features you ask for.
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Stackivo is built by a small team in India. There&rsquo;s no
              tier-one queue between you and the people who built the
              product — open the chat at the bottom-right or email{" "}
              <a
                href="mailto:support@stackivo.me"
                className="font-medium text-foreground underline underline-offset-4 hover:opacity-80"
              >
                support@stackivo.me
              </a>
              .
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <Link
                href="/about"
                className="inline-flex items-center gap-1.5 font-medium text-foreground hover:opacity-80"
              >
                What we believe <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 font-medium text-foreground hover:opacity-80"
              >
                Talk to us <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
