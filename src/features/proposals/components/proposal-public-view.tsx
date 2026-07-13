import * as React from "react";
import { CalendarDays, CheckCircle2, FileText, IndianRupee } from "lucide-react";

import { formatMoney } from "@/lib/format";
import { getProposalBillingGuidance } from "../intelligence";
import type { PublicProposalData } from "../public";

export function ProposalPublicView({ data }: { data: PublicProposalData }) {
  const { proposal, items, seller, client, project } = data;
  const sellerName =
    seller?.business_name || seller?.company_name || seller?.full_name || "Freelancer";
  const clientName = client?.business_name || client?.full_name || "Client";
  const guidance = getProposalBillingGuidance({
    seller: {
      gstRegistered: seller?.gst_registered ?? false,
      stateCode: seller?.state_code ?? null,
      defaultGstRate: seller?.invoice_default_gst_rate ?? 18,
      lutNumber: seller?.lut_number ?? null,
    },
    client: client
      ? {
          id: client.id,
          country: client.country,
          currency: client.currency,
          isForeign: client.is_foreign,
          gstRegistered: client.gst_registered,
          stateCode: client.state_code,
        }
      : null,
    fallbackCurrency: proposal.currency,
  });

  return (
    <article className="bg-card">
      <header className="border-b bg-gradient-to-b from-muted/50 to-background px-5 py-7 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Proposal
            </span>
            <div>
              <h2 className="text-balance text-3xl font-semibold tracking-tight">
                {proposal.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Prepared by {sellerName} for {clientName}
                {project?.name ? ` for ${project.name}` : ""}.
              </p>
            </div>
          </div>
          <div className="rounded-lg border bg-background p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Investment
            </p>
            <p className="mt-2 text-3xl font-bold">
              {formatMoney(Number(proposal.total_amount), proposal.currency)}
            </p>
            {proposal.valid_until ? (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Valid until {formatDate(proposal.valid_until)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Meta label="Status" value={proposal.status} />
          <Meta label="Currency" value={proposal.currency} />
          <Meta label="Project" value={project?.name ?? "Not linked"} />
        </div>
      </header>

      <section className="grid gap-3 border-b px-5 py-5 sm:grid-cols-2 sm:px-8">
        <Party heading="From" name={sellerName}>
          {seller?.business_email || seller?.email ? (
            <p>{seller.business_email || seller.email}</p>
          ) : null}
          {seller?.business_phone || seller?.phone ? (
            <p>{seller.business_phone || seller.phone}</p>
          ) : null}
          {formatSellerAddress(seller).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </Party>
        <Party heading="Prepared for" name={clientName}>
          {client?.email ? <p>{client.email}</p> : null}
          {client?.phone ? <p>{client.phone}</p> : null}
          {client?.billing_address || client?.address ? (
            <p>{client.billing_address || client.address}</p>
          ) : null}
        </Party>
      </section>

      <section className="space-y-6 px-5 py-7 sm:px-8 sm:py-9">
        <Section title="Packages and pricing">
          <div className="overflow-hidden rounded-lg border">
            <div className="hidden grid-cols-[minmax(0,1fr)_90px_120px_130px] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="divide-y">
              {items.length > 0 ? (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-2 px-4 py-4 text-sm md:grid-cols-[minmax(0,1fr)_90px_120px_130px] md:gap-3"
                  >
                    <p className="font-medium">{item.description}</p>
                    <p className="text-muted-foreground md:text-right">{Number(item.quantity)}</p>
                    <p className="text-muted-foreground md:text-right">
                      {formatMoney(Number(item.unit_price), proposal.currency)}
                    </p>
                    <p className="font-semibold md:text-right">
                      {formatMoney(Number(item.amount), proposal.currency)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="px-4 py-5 text-sm text-muted-foreground">
                  Pricing will be confirmed in writing.
                </div>
              )}
            </div>
            <div className="ml-auto grid max-w-sm gap-2 border-t bg-muted/30 px-4 py-4 text-sm">
              <SummaryRow label="Subtotal" value={formatMoney(Number(proposal.subtotal), proposal.currency)} />
              <SummaryRow label="Tax / charges" value={formatMoney(Number(proposal.tax_amount), proposal.currency)} />
              <SummaryRow label="Total" value={formatMoney(Number(proposal.total_amount), proposal.currency)} strong />
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">{guidance.modeLabel}</p>
            <p className="mt-1">{guidance.publicNote}</p>
          </div>
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Scope">
            <RichText value={proposal.scope} empty="Scope will be confirmed before kickoff." />
          </Section>
          <Section title="Deliverables">
            <RichText value={proposal.deliverables} empty="Deliverables will be confirmed before kickoff." />
          </Section>
          <Section title="Timeline">
            <RichText value={proposal.timeline} empty="Timeline will be mutually confirmed." />
          </Section>
          <Section title="Terms">
            <RichText value={proposal.terms} empty="Commercial terms will be confirmed in writing." />
          </Section>
        </div>

        <div className="rounded-lg border bg-emerald-500/5 p-4 text-sm text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Next step
          </div>
          Review the scope, pricing, and timeline. If everything looks right,
          reply to the freelancer to move into contract and kickoff.
        </div>
      </section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <IndianRupee className="h-4 w-4 text-primary" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Party({
  heading,
  name,
  children,
}: {
  heading: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {heading}
      </p>
      <p className="mt-2 text-sm font-semibold">{name}</p>
      <div className="mt-1 space-y-0.5 text-xs leading-5 text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium capitalize tabular-nums">{value}</p>
    </div>
  );
}

function RichText({ value, empty }: { value: string | null; empty: string }) {
  return (
    <p className="whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm leading-7 text-muted-foreground">
      {value?.trim() || empty}
    </p>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={strong ? "flex justify-between border-t pt-2 font-bold" : "flex justify-between"}>
      <span className={strong ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatSellerAddress(seller: PublicProposalData["seller"]) {
  return [
    seller?.address_line1,
    seller?.address_line2,
    [seller?.city, seller?.postal_code].filter(Boolean).join(" "),
    seller?.country,
  ].filter((line): line is string => Boolean(line));
}
