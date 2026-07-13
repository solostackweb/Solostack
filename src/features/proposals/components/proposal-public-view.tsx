import * as React from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Landmark,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { getProposalBillingGuidance } from "../intelligence";
import type { PublicProposalData } from "../public";
import { acceptPublicProposalAction } from "../actions";

export function ProposalPublicView({ data }: { data: PublicProposalData }) {
  const { proposal, items, seller, client, project } = data;
  const sellerName =
    seller?.business_name || seller?.company_name || seller?.full_name || "Freelancer";
  const clientName = client?.business_name || client?.full_name || "Client";
  const statusLabel = proposal.status.replace(/_/g, " ");
  const hasTax = Number(proposal.tax_amount) > 0;
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
    <article className="bg-card text-card-foreground">
      <header className="relative overflow-hidden border-b bg-background px-5 py-8 sm:px-8 lg:px-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/8 to-transparent" />
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground shadow-sm">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Proposal
            </span>
            <h2 className="mt-5 max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              {proposal.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Prepared by <span className="font-medium text-foreground">{sellerName}</span> for{" "}
              <span className="font-medium text-foreground">{clientName}</span>
              {project?.name ? ` for ${project.name}` : ""}.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Meta label="Status" value={statusLabel} />
              <Meta label="Currency" value={proposal.currency} />
              {proposal.valid_until ? (
                <Meta label="Valid until" value={formatDate(proposal.valid_until)} />
              ) : null}
            </div>
          </div>

          <aside className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Total investment
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight">
                  {formatMoney(Number(proposal.total_amount), proposal.currency)}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CircleDollarSign className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-5 grid gap-2 border-t pt-4 text-sm">
              <SummaryRow
                label="Subtotal"
                value={formatMoney(Number(proposal.subtotal), proposal.currency)}
              />
              {hasTax ? (
                <SummaryRow
                  label="Tax / charges"
                  value={formatMoney(Number(proposal.tax_amount), proposal.currency)}
                />
              ) : null}
              <p className="mt-2 rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                {guidance.publicNote}
              </p>
            </div>
          </aside>
        </div>
      </header>

      <section className="grid gap-4 border-b bg-muted/20 px-5 py-5 sm:grid-cols-2 sm:px-8 lg:px-10">
        <Party icon={Landmark} heading="From" name={sellerName}>
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
        <Party icon={UserRound} heading="Prepared for" name={clientName}>
          {client?.email ? <p>{client.email}</p> : null}
          {client?.phone ? <p>{client.phone}</p> : null}
          {client?.billing_address || client?.address ? (
            <p>{client.billing_address || client.address}</p>
          ) : null}
        </Party>
      </section>

      <section className="space-y-8 px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <Section eyebrow="Commercials" title="Packages and pricing">
          <div className="overflow-hidden rounded-xl border bg-background">
            <div className="hidden grid-cols-[minmax(0,1fr)_80px_120px_130px] gap-3 border-b bg-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid">
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
                    className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[minmax(0,1fr)_80px_120px_130px] md:gap-3"
                  >
                    <p className="font-medium leading-6">{item.description}</p>
                    <p className="text-muted-foreground md:text-right">
                      <span className="md:hidden">Qty </span>
                      {Number(item.quantity)}
                    </p>
                    <p className="text-muted-foreground md:text-right">
                      <span className="md:hidden">Rate </span>
                      {formatMoney(Number(item.unit_price), proposal.currency)}
                    </p>
                    <p className="font-semibold md:text-right">
                      <span className="md:hidden text-muted-foreground">Amount </span>
                      {formatMoney(Number(item.amount), proposal.currency)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="px-5 py-5 text-sm text-muted-foreground">
                  Pricing will be confirmed in writing.
                </div>
              )}
            </div>
            <div className="border-t bg-muted/20 px-5 py-4">
              <div className="ml-auto grid max-w-sm gap-2 text-sm">
                <SummaryRow
                  label="Subtotal"
                  value={formatMoney(Number(proposal.subtotal), proposal.currency)}
                />
                <SummaryRow
                  label="Tax / charges"
                  value={formatMoney(Number(proposal.tax_amount), proposal.currency)}
                />
                <SummaryRow
                  label="Total"
                  value={formatMoney(Number(proposal.total_amount), proposal.currency)}
                  strong
                />
              </div>
            </div>
          </div>
          <InfoStrip title={guidance.modeLabel}>{guidance.publicNote}</InfoStrip>
        </Section>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section eyebrow="01" title="Scope">
            <RichText value={proposal.scope} empty="Scope will be confirmed before kickoff." />
          </Section>
          <Section eyebrow="02" title="Deliverables">
            <RichText value={proposal.deliverables} empty="Deliverables will be confirmed before kickoff." />
          </Section>
          <Section eyebrow="03" title="Timeline">
            <RichText value={proposal.timeline} empty="Timeline will be mutually confirmed." />
          </Section>
          <Section eyebrow="04" title="Terms">
            <RichText value={proposal.terms} empty="Commercial terms will be confirmed in writing." />
          </Section>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-sm text-muted-foreground">
          {proposal.status === "accepted" ? (
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <p className="font-semibold text-foreground">Proposal accepted</p>
                <p className="mt-1 leading-6">
                  This proposal has been acknowledged. The freelancer can now move it into a
                  contract, project, or invoice.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                <div>
                  <p className="font-semibold text-foreground">Ready to move ahead?</p>
                  <p className="mt-1 max-w-2xl leading-6">
                    Accepting this proposal acknowledges the scope and pricing so the freelancer
                    can prepare the next step. This is not an e-signature contract.
                  </p>
                </div>
              </div>
              <form action={acceptPublicProposalAction}>
                <input type="hidden" name="token" value={proposal.public_token} />
                <Button type="submit" className="w-full sm:w-auto">
                  <CheckCircle2 className="h-4 w-4" /> Accept proposal
                </Button>
              </form>
            </div>
          )}
        </div>
      </section>
    </article>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Party({
  icon: Icon,
  heading,
  name,
  children,
}: {
  icon: typeof Landmark;
  heading: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-xl border bg-card p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {heading}
        </p>
        <p className="mt-1 truncate text-sm font-semibold">{name}</p>
        <div className="mt-1 space-y-0.5 text-xs leading-5 text-muted-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border bg-card px-3 py-1.5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="text-xs font-semibold capitalize tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function RichText({ value, empty }: { value: string | null; empty: string }) {
  return (
    <p className="min-h-32 whitespace-pre-wrap rounded-xl border bg-background p-5 text-sm leading-7 text-muted-foreground">
      {value?.trim() || empty}
    </p>
  );
}

function InfoStrip({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-muted/25 p-4 text-sm text-muted-foreground">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 leading-6">{children}</p>
    </div>
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
