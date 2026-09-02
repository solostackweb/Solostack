import {
  Check,
  CircleDot,
  FileSignature,
  FolderKanban,
  ReceiptText,
  Users,
} from "lucide-react";

/** Complete supporting product views used around the primary Pulse dashboard. */
export function HeroClientMockup() {
  return (
    <div className="bg-background p-4 text-left sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary">
            N
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">Nexa Labs</p>
            <p className="text-micro text-muted-foreground">Client workspace · Bengaluru</p>
          </div>
        </div>
        <span className="rounded-full bg-success-subtle px-2 py-1 text-micro font-semibold text-success-strong">
          Active
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 border-y border-border py-3">
        <ClientStat label="Projects" value="3" />
        <ClientStat label="Open value" value="₹2.4L" />
        <ClientStat label="Unbilled" value="18.5 h" />
      </div>

      <p className="mt-4 text-xs font-semibold text-foreground">Current engagement</p>
      <div className="mt-2 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs font-medium text-foreground">
            <FolderKanban className="h-3.5 w-3.5 text-primary" />
            Product launch system
          </span>
          <span className="text-micro text-muted-foreground">68%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[68%] rounded-full bg-primary" />
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <ClientStep icon={Users} label="Brief approved" meta="05 Aug" complete />
        <ClientStep icon={FileSignature} label="Contract signed" meta="08 Aug" complete />
        <ClientStep icon={CircleDot} label="Delivery in progress" meta="Today" />
        <ClientStep icon={ReceiptText} label="Invoice after handoff" meta="Next" muted />
      </div>
    </div>
  );
}

export function HeroInvoiceMockup() {
  return (
    <div className="bg-background p-4 text-left sm:p-5">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
        <div>
          <p className="font-display text-lg font-semibold tracking-[-0.03em] text-foreground">Invoice</p>
          <p className="mt-0.5 font-mono text-micro text-muted-foreground">INV-2026-042</p>
        </div>
        <span className="rounded-full bg-info-subtle px-2 py-1 text-micro font-semibold text-info-strong">
          Sent
        </span>
      </div>

      <div className="mt-3 flex items-start justify-between gap-4 text-micro">
        <div>
          <p className="text-muted-foreground">Bill to</p>
          <p className="mt-0.5 font-semibold text-foreground">Nexa Labs Pvt. Ltd.</p>
          <p className="text-muted-foreground">29ABCDE1234F1Z5</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">Due 28 Aug 2026</p>
          <p className="mt-0.5 font-medium text-foreground">Place of supply</p>
          <p className="text-muted-foreground">Karnataka · 29</p>
        </div>
      </div>

      <div className="mt-4 border-y border-border">
        <InvoiceLine label="Discovery & UX direction" amount="₹42,000" />
        <InvoiceLine label="Product interface build" amount="₹84,000" />
        <InvoiceLine label="Handoff documentation" amount="₹18,500" />
      </div>

      <dl className="ml-auto mt-3 w-[72%] space-y-1.5 text-micro">
        <InvoiceTotal label="Subtotal" value="₹1,44,500" />
        <InvoiceTotal label="CGST · 9%" value="₹13,005" />
        <InvoiceTotal label="SGST · 9%" value="₹13,005" />
        <div className="flex justify-between border-t border-foreground pt-2 font-semibold text-foreground">
          <dt>Total due</dt>
          <dd className="font-mono tabular-nums">₹1,70,510</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center gap-2 rounded-lg bg-success-subtle px-3 py-2 text-micro font-medium text-success-strong">
        <Check className="h-3.5 w-3.5" />
        Same-state supply · CGST and SGST applied
      </div>
    </div>
  );
}

function ClientStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-border px-2 first:pl-0 last:border-r-0 last:pr-0">
      <p className="font-mono text-xs font-medium tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-micro text-muted-foreground">{label}</p>
    </div>
  );
}

function ClientStep({
  icon: Icon,
  label,
  meta,
  complete,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  meta: string;
  complete?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${muted ? "bg-muted/40" : "bg-card"}`}>
      <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${complete ? "bg-success-subtle text-success-strong" : "bg-accent text-primary"}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className={`min-w-0 flex-1 truncate text-micro font-medium ${muted ? "text-muted-foreground" : "text-foreground"}`}>
        {label}
      </span>
      <span className="text-micro text-muted-foreground">{meta}</span>
    </div>
  );
}

function InvoiceLine({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-micro last:border-b-0">
      <span className="text-foreground">{label}</span>
      <span className="shrink-0 font-mono tabular-nums text-foreground">{amount}</span>
    </div>
  );
}

function InvoiceTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="font-mono tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
