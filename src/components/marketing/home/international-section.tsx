import { Globe2, Landmark, Lock, ShieldCheck } from "lucide-react";
import { Section, SectionHeading } from "../section";
import { Reveal, StaggerItem, StaggerReveal } from "../motion";

/**
 * International section — most Indian freelancers' best clients are abroad.
 * Shows the three things that matter for cross-border work: invoice in the
 * client's currency, get paid on the platforms they already use, and stay
 * compliant (FX locked at issue + zero-rated export under LUT).
 */

const CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "Pound" },
  { code: "AUD", symbol: "A$", label: "Aus Dollar" },
  { code: "CAD", symbol: "C$", label: "Can Dollar" },
  { code: "AED", symbol: "د.إ", label: "Dirham" },
  { code: "SGD", symbol: "S$", label: "Sing Dollar" },
  { code: "INR", symbol: "₹", label: "Rupee" },
];

const PLATFORMS = [
  { name: "Wise", color: "#9FE870" },
  { name: "PayPal", color: "#003087" },
  { name: "Payoneer", color: "#FF4800" },
  { name: "Stripe", color: "#635BFF" },
  { name: "Revolut", color: "#191C1F" },
  { name: "Remitly", color: "#1F6FEB" },
];

export function InternationalSection() {
  return (
    <Section id="international" size="ultra" className="relative border-b">
      <Reveal>
        <SectionHeading
          eyebrow="Built for global work"
          title="Your best clients are abroad. Stackivo is built for that."
          subtitle="Most Indian freelancers earn in dollars, euros and pounds. Invoice clients in their own currency, get paid on the platforms they trust, and let Stackivo keep the tax and books correct."
        />
      </Reveal>

      {/* Currencies + platforms proof row */}
      <Reveal>
        <div className="mt-10 grid gap-4 rounded-2xl border border-border/70 bg-muted/30 p-5 sm:p-7 lg:mt-12 lg:grid-cols-2 lg:gap-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              Invoice in any currency
            </p>
            <ul className="mt-4 flex flex-wrap gap-2.5">
              {CURRENCIES.map((c) => (
                <li
                  key={c.code}
                  className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 py-1.5 text-[13px] font-medium text-foreground"
                  title={c.label}
                >
                  <span className="font-display text-primary">{c.symbol}</span>
                  {c.code}
                </li>
              ))}
              <li className="flex items-center rounded-full border border-dashed border-border/70 px-3 py-1.5 text-[13px] font-medium text-muted-foreground">
                + more
              </li>
            </ul>
          </div>

          <div className="lg:border-l lg:border-border/60 lg:pl-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              Get paid on the platforms they use
            </p>
            <ul className="mt-4 flex flex-wrap items-center gap-2.5">
              {PLATFORMS.map((p) => (
                <li
                  key={p.name}
                  className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2"
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-[13px] font-medium text-foreground">{p.name}</span>
                </li>
              ))}
              <li className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px] font-medium text-foreground">Bank wire</span>
              </li>
            </ul>
            <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
              Connect your own accounts — Stackivo shows them on the invoice and
              never collects or holds your money.
            </p>
          </div>
        </div>
      </Reveal>

      {/* Compliance / trust explainers */}
      <StaggerReveal className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <StaggerItem>
          <ExplainerCard
            icon={Lock}
            title="Exchange rate locked at issue"
            body="The FX rate is captured the moment you issue the invoice, so your INR books and Pulse analytics stay accurate — no spreadsheets, no manual conversion later."
          />
        </StaggerItem>
        <StaggerItem>
          <ExplainerCard
            icon={ShieldCheck}
            title="Zero-rated export, done right"
            body="Exporting services? Stackivo issues a compliant zero-rated invoice under LUT — no IGST charged, with the correct export declaration printed on the PDF."
          />
        </StaggerItem>
        <StaggerItem>
          <ExplainerCard
            icon={Globe2}
            title="Pulse in one currency"
            body="Foreign invoices roll up to INR automatically, so revenue, receivables and your best-client rankings are always comparable at a glance."
          />
        </StaggerItem>
      </StaggerReveal>
    </Section>
  );
}

function ExplainerCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Lock;
  title: string;
  body: string;
}) {
  return (
    <div className="h-full rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 font-display text-[17px] font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-[14px] leading-[1.7] text-muted-foreground">{body}</p>
    </div>
  );
}
