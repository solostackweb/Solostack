function WindowBar({ label }: { label: string }) {
  return (
    <div className="flex h-9 items-center gap-1.5 border-b border-border bg-muted/45 px-3">
      <span className="h-1.5 w-1.5 rounded-full bg-border" />
      <span className="h-1.5 w-1.5 rounded-full bg-border" />
      <span className="h-1.5 w-1.5 rounded-full bg-border" />
      <span className="ml-2 text-micro text-muted-foreground">{label}</span>
    </div>
  );
}

function ClientWindow() {
  return (
    <article className="absolute left-[2%] top-32 hidden w-[320px] -rotate-3 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_70px_-28px_hsl(224_45%_28%/0.34)] md:block lg:left-[4%]">
      <WindowBar label="Client workspace" />
      <div className="p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent font-display text-sm font-bold text-accent-foreground">
            NL
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Nexa Labs</p>
            <p className="text-micro text-muted-foreground">Product design retainer</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border p-3">
            <p className="text-micro text-muted-foreground">Project health</p>
            <p className="mt-1 text-xs font-semibold text-foreground">On track</p>
            <span className="mt-2 block h-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full w-[72%] rounded-full bg-primary" />
            </span>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-micro text-muted-foreground">Unbilled time</p>
            <p className="mt-2 font-mono text-sm font-medium tabular-nums text-foreground">18.5 h</p>
          </div>
        </div>
      </div>
    </article>
  );
}

function InvoiceWindow() {
  return (
    <article className="absolute left-1/2 top-10 z-10 w-[min(92%,480px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_90px_-32px_hsl(224_45%_28%/0.4)]">
      <WindowBar label="Invoice · INV-2026-042" />
      <div className="p-5 text-left sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xl font-bold tracking-[-0.04em] text-foreground">Invoice</p>
            <p className="mt-1 text-micro text-muted-foreground">Issued 20 Aug 2026</p>
          </div>
          <span className="rounded-full bg-success-subtle px-2.5 py-1 text-micro font-semibold text-success-strong">
            Ready to send
          </span>
        </div>
        <div className="mt-5 divide-y divide-border border-y border-border text-xs">
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="text-foreground">Product design retainer</span>
            <span className="font-mono tabular-nums text-foreground">₹84,000.00</span>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="text-muted-foreground">IGST · 18%</span>
            <span className="font-mono tabular-nums text-muted-foreground">₹15,120.00</span>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm font-semibold">
          <span>Total due</span>
          <span className="font-mono tabular-nums">₹99,120.00</span>
        </div>
      </div>
    </article>
  );
}

function PaymentWindow() {
  return (
    <article className="absolute right-[2%] top-36 hidden w-[320px] rotate-3 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_70px_-28px_hsl(224_45%_28%/0.34)] md:block lg:right-[4%]">
      <WindowBar label="Payment received" />
      <div className="p-5 text-left">
        <span className="rounded-full bg-success-subtle px-2.5 py-1 text-micro font-semibold text-success-strong">
          Paid in full
        </span>
        <p className="mt-4 font-mono text-2xl font-medium tracking-[-0.04em] tabular-nums text-foreground">
          ₹99,120
        </p>
        <p className="mt-1 text-micro text-muted-foreground">Razorpay · UTR 4268••9012</p>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-micro">
          <span className="text-muted-foreground">Matched automatically</span>
          <span className="font-mono tabular-nums text-foreground">10:42 AM</span>
        </div>
      </div>
    </article>
  );
}

export function HeroFlow() {
  return (
    <div className="relative mx-auto mt-12 h-[410px] w-full max-w-[1180px] sm:h-[470px] lg:h-[500px]" aria-hidden>
      <svg
        className="absolute inset-x-6 top-16 hidden h-[360px] w-[calc(100%-3rem)] text-primary/35 md:block"
        viewBox="0 0 1100 420"
        preserveAspectRatio="none"
      >
        <path
          d="M40 280C210 100 330 340 540 180C730 35 830 340 1060 170"
          fill="none"
          stroke="currentColor"
          strokeDasharray="5 8"
          strokeWidth="1.4"
        />
      </svg>
      <span className="absolute left-[5%] top-[62%] hidden h-2.5 w-2.5 rounded-full border-2 border-card bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.12)] md:block" />
      <span className="absolute left-1/2 top-[38%] hidden h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-card bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.12)] md:block" />
      <span className="absolute right-[5%] top-[40%] hidden h-2.5 w-2.5 rounded-full border-2 border-card bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.12)] md:block" />
      <ClientWindow />
      <InvoiceWindow />
      <PaymentWindow />
    </div>
  );
}
