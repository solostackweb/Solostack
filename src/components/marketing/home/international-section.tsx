import { ArrowRight, Globe2, Landmark, Lock, ShieldCheck, Wallet } from "lucide-react";
import { Section, SectionHeading } from "../section";
import { Reveal, StaggerItem, StaggerReveal } from "../motion";

/**
 * International section — most Indian freelancers' best clients are abroad.
 * Leads with a concrete mock export invoice (product proof) and pairs it with
 * the three things that matter cross-border: invoice in the client's currency,
 * get paid on platforms they trust, and stay compliant (FX locked at issue +
 * zero-rated export under LUT, consolidated to INR in Pulse).
 */

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "AED", "SGD"];

const PLATFORMS = [
  { name: "Wise", color: "#9FE870" },
  { name: "PayPal", color: "#0070E0" },
  { name: "Payoneer", color: "#FF4800" },
  { name: "Stripe", color: "#635BFF" },
  { name: "Revolut", color: "#1F6FEB" },
  { name: "Remitly", color: "#2Fae5e" },
];

export function InternationalSection() {
  return (
    <Section id="international" size="ultra" className="relative overflow-hidden border-b">
      {/* Soft brand wash */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-[130px]" />
      </div>

      <Reveal>
        <SectionHeading
          eyebrow="Built for global work"
          title={
            <>
              Your best clients are abroad.{" "}
              <span className="text-gradient">Stackivo is built for that.</span>
            </>
          }
          subtitle="Most Indian freelancers earn in dollars, euros and pounds. Invoice clients in their own currency, get paid on the platforms they trust, and let Stackivo keep the tax and books correct — automatically."
        />
      </Reveal>

      {/* Showcase: mock export invoice + currency / platform proof */}
      <div className="mt-12 grid items-center gap-10 lg:mt-16 lg:grid-cols-2 lg:gap-14">
        <Reveal>
          <InvoiceMock />
        </Reveal>

        <Reveal>
          <div className="space-y-7">
            <ProofRow
              icon={Globe2}
              title="Invoice in any currency"
              copy="Pick the client's currency once — every invoice, receipt and reminder uses it automatically."
            >
              <ul className="mt-3 flex flex-wrap gap-2">
                {CURRENCIES.map((c) => (
                  <li
                    key={c}
                    className="rounded-lg border border-border/70 bg-background px-2.5 py-1 font-mono text-xs font-medium tabular-nums text-foreground"
                  >
                    {c}
                  </li>
                ))}
                <li className="rounded-lg border border-dashed border-border/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  +20 more
                </li>
              </ul>
            </ProofRow>

            <ProofRow
              icon={Wallet}
              title="Get paid the way they already pay"
              copy="Connect your own Wise, PayPal, Payoneer, Stripe or bank account — shown right on the invoice. Stackivo never holds your money."
            >
              <ul className="mt-3 flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <li
                    key={p.name}
                    className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-background px-2.5 py-1 text-xs font-medium text-foreground"
                  >
                    <span
                      aria-hidden
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.name}
                  </li>
                ))}
                <li className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-background px-2.5 py-1 text-xs font-medium text-foreground">
                  <Landmark className="h-3 w-3 text-muted-foreground" />
                  Bank wire
                </li>
              </ul>
            </ProofRow>
          </div>
        </Reveal>
      </div>

      {/* Compliance / trust explainers */}
      <StaggerReveal className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
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
            title="Pulse, consolidated to INR"
            body="Foreign invoices roll up to INR automatically, so revenue, receivables and your best-client rankings are always comparable at a glance."
          />
        </StaggerItem>
      </StaggerReveal>
    </Section>
  );
}

/** A premium mock of a foreign-currency export invoice — the product proof. */
function InvoiceMock() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/[0.16] via-primary/[0.04] to-transparent blur-2xl"
      />
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl shadow-primary/[0.10] ring-1 ring-foreground/[0.04]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-5 py-3.5">
          <div>
            <p className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
              Invoice
            </p>
            <p className="font-display text-sm font-semibold text-foreground">INV-0042</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-micro font-semibold text-success">
            <Globe2 className="h-3 w-3" /> Export · LUT
          </span>
        </div>

        {/* Bill to + currency */}
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
              Billed to
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">Acme Inc.</p>
            <p className="text-xs text-muted-foreground">San Francisco, USA</p>
          </div>
          <span className="rounded-lg border border-border/70 bg-background px-2.5 py-1 font-mono text-xs font-medium text-foreground">
            USD $
          </span>
        </div>

        {/* Line item */}
        <div className="mx-5 rounded-lg border border-border/60 bg-background/60 p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground">Website redesign — landing + CMS</span>
            <span className="font-mono tabular-nums text-foreground">$1,200.00</span>
          </div>
        </div>

        {/* Totals */}
        <div className="space-y-2 px-5 py-4 text-xs">
          <Row label="Subtotal" value="$1,200.00" />
          <Row label="GST" value="Zero-rated (LUT)" valueClass="text-success" />
          <div className="my-1 h-px bg-border/70" />
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Total due</span>
            <span className="font-display text-base font-semibold tabular-nums text-foreground">
              $1,200.00
            </span>
          </div>
        </div>

        {/* FX note + pay actions */}
        <div className="border-t border-border/70 bg-muted/30 px-5 py-3.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            FX locked at issue · ₹83.24 / $1 ·{" "}
            <span className="font-mono tabular-nums">₹99,888</span> in your books
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <span className="flex items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background">
              Pay with Wise <ArrowRight className="h-3.5 w-3.5" />
            </span>
            <span className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground">
              PayPal
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass = "text-muted-foreground",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

function ProofRow({
  icon: Icon,
  title,
  copy,
  children,
}: {
  icon: typeof Globe2;
  title: string;
  copy: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{copy}</p>
        {children}
      </div>
    </div>
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
    <div className="group h-full rounded-2xl border border-border/70 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/[0.06] sm:p-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/10">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-[1.7] text-muted-foreground">{body}</p>
    </div>
  );
}
