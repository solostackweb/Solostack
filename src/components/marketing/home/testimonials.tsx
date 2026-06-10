import { Section, SectionHeading } from "../section";
import { Reveal, StaggerItem, StaggerReveal } from "../motion";

/**
 * Social proof — early-access quotes from real freelancers (carried over
 * from the previous site; edit the array to add more).
 */
const TESTIMONIALS = [
  {
    quote:
      "I used to spend 30 minutes per invoice between Excel, WhatsApp, and manually tracking who's paid. Stackivo cut that to under 5 minutes. The WhatsApp share button alone is worth it.",
    name: "Priya Menon",
    role: "UI/UX Designer · Bengaluru",
    initial: "P",
  },
  {
    quote:
      "GST was the thing I dreaded most as a consultant. I kept second-guessing CGST vs IGST for different clients. Stackivo handles it automatically — I just pick the client and it figures out the tax.",
    name: "Rahul Sharma",
    role: "Fullstack Developer · Pune",
    initial: "R",
  },
  {
    quote:
      "I switched from FreshBooks mainly because it was way overkill for what I do. Stackivo is lean — clients, invoices, get paid. No learning curve. Had my first invoice out in 10 minutes.",
    name: "Divya Krishnan",
    role: "Brand Strategist · Chennai",
    initial: "D",
  },
];

export function Testimonials() {
  return (
    <Section className="py-20 sm:py-24 lg:py-28">
      <Reveal>
        <SectionHeading
          eyebrow="Early access"
          title="People who already made the switch."
          subtitle="A small but growing group of independent professionals who traded spreadsheets and tab-juggling for one clean workspace."
        />
      </Reveal>

      <StaggerReveal className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3 lg:mt-16">
        {TESTIMONIALS.map((t) => (
          <StaggerItem key={t.name} className="h-full">
            <figure className="flex h-full flex-col rounded-3xl border border-border/80 bg-card p-7">
              <div className="text-2xl font-serif leading-none text-primary/30" aria-hidden>
                &ldquo;
              </div>
              <blockquote className="mt-2 flex-1 text-[15px] leading-[1.7] text-foreground/90">
                {t.quote}
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-border/60 pt-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {t.initial}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          </StaggerItem>
        ))}
      </StaggerReveal>
    </Section>
  );
}
