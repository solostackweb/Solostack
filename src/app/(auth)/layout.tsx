import { Check, IndianRupee, ShieldCheck, Zap } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { getMarketingAuthState } from "@/features/marketing/auth-state";

/**
 * Auth route group — same marketing header + footer so login / signup /
 * portal access feel like the product. Two-column stage: value panel on the
 * left (desktop), form card on the right. Single centered column on mobile.
 */
const VALUE_POINTS = [
  "Clients, contracts, invoices, projects & time in one workspace",
  "Simple or full GST invoicing — picked per client, automatically",
  "Branded client portal that answers “how’s it going?” for you",
  "Payments via UPI, cards & netbanking, reconciled for you",
];

const STATS = [
  { icon: Zap, label: "2-minute setup" },
  { icon: IndianRupee, label: "Free for 5 clients" },
  { icon: ShieldCheck, label: "Daily backups" },
];

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authState = await getMarketingAuthState();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <MarketingHeader authState={authState} />

      <main className="relative isolate flex flex-1 items-center overflow-hidden px-5 py-12 sm:px-8 sm:py-14">
        {/* Backdrop — same family as the marketing heroes */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[15%] top-[-30%] h-[480px] w-[800px] rounded-full bg-primary/[0.07] blur-[110px]" />
          <div
            className="absolute inset-0 opacity-[0.3] [mask-image:radial-gradient(ellipse_60%_70%_at_40%_10%,black,transparent)]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--border)/0.7) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)/0.7) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />
        </div>

        {/*
          `items-start` (not `items-center`) is deliberate: the value panel
          and the form card have independent, unrelated heights (the signup
          card in particular grows tall — OAuth consent line, three inputs,
          a DPDP disclosure box, a terms checkbox, and a captcha widget).
          Vertically centering two columns of different heights pushes the
          shorter one down by half the height difference, which reads as a
          big dead gap above it. Top-aligning keeps both columns starting
          at the same y — the standard pattern for split auth screens.
        */}
        <div className="mx-auto grid w-full max-w-[1100px] items-start gap-12 lg:grid-cols-[1.05fr_420px] lg:gap-20">
          {/* Left: value panel — desktop only */}
          <div className="hidden lg:block">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-micro font-semibold uppercase tracking-widest text-primary">
              Built for Indian freelancers &amp; studios
            </p>
            <h2 className="mt-5 max-w-md font-display text-3xl font-semibold leading-[1.12] tracking-[-0.02em] text-foreground">
              Everything between you and getting paid, handled.
            </h2>

            <ul className="mt-7 space-y-3.5">
              {VALUE_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-foreground/90">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {point}
                </li>
              ))}
            </ul>

            {/* Testimonial */}
            <figure className="mt-8 max-w-md rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm backdrop-blur">
              <blockquote className="text-sm leading-relaxed text-foreground/90">
                &ldquo;I had my first invoice out in 10 minutes. No learning
                curve — clients, invoices, get paid.&rdquo;
              </blockquote>
              <figcaption className="mt-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  D
                </span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Divya Krishnan</span>
                  {" "}· Brand Strategist, Chennai
                </span>
              </figcaption>
            </figure>

            {/* Stat chips */}
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2">
              {STATS.map((s) => (
                <span key={s.label} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <s.icon className="h-3.5 w-3.5 text-primary/70" />
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          {/* Right: form card */}
          <div className="mx-auto w-full max-w-[420px] lg:mx-0">
            <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xl shadow-primary/[0.06] sm:p-7">
              {children}
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground/80 lg:hidden">
              Free for your first 5 clients · No card required
            </p>
          </div>
        </div>
      </main>

      <MarketingFooter authState={authState} />
    </div>
  );
}
