import * as React from "react";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Download,
  FileCheck2,
  FileText,
  Landmark,
  ListChecks,
  Mail,
  MapPin,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { getProposalBillingGuidance } from "../intelligence";
import type { PublicProposalData } from "../public";
import { acceptPublicProposalAction } from "../actions";

export function ProposalPublicView({
  data,
  pdfUrl,
}: {
  data: PublicProposalData;
  pdfUrl?: string;
}) {
  const { proposal, items, seller, client, project } = data;
  const sellerName =
    seller?.business_name || seller?.company_name || seller?.full_name || "Freelancer";
  const clientName = client?.business_name || client?.full_name || "Client";
  const sellerEmail = seller?.business_email || seller?.email || null;
  const clientEmail = client?.email ?? null;
  const statusLabel = proposal.status.replace(/_/g, " ");
  const total = Number(proposal.total_amount);
  const subtotal = Number(proposal.subtotal);
  const taxAmount = Number(proposal.tax_amount);
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
      <header className="border-b bg-background px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-stretch">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-micro font-semibold uppercase tracking-[0.16em] text-muted-foreground shadow-sm">
                <FileText className="h-3.5 w-3.5 text-primary" />
                Proposal
              </span>
              <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-micro font-semibold capitalize text-primary">
                {statusLabel}
              </span>
            </div>

            <h2 className="mt-5 max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              {proposal.title}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Hi {clientName}, here is a clear offer from{" "}
              <span className="font-medium text-foreground">{sellerName}</span>. It outlines the
              work, commercial terms, and the next step before contract or kickoff.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <GlanceItem
                icon={CircleDollarSign}
                label="Investment"
                value={formatMoney(total, proposal.currency)}
              />
              <GlanceItem
                icon={CalendarDays}
                label="Valid until"
                value={proposal.valid_until ? formatDate(proposal.valid_until) : "To be confirmed"}
              />
              <GlanceItem
                icon={BriefcaseBusiness}
                label="Project"
                value={project?.name ?? "Not linked yet"}
              />
            </div>
          </div>

          <aside className="flex flex-col justify-between rounded-2xl bg-foreground p-6 text-background shadow-lg shadow-slate-900/10">
            <div>
              <p className="text-micro font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Total proposal value
              </p>
              <p className="mt-3 text-4xl font-bold tracking-tight tabular-nums">
                {formatMoney(total, proposal.currency)}
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {guidance.publicNote}
              </p>
            </div>
            <div className="mt-6 grid gap-2 border-t border-white/10 pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums text-background">
                  {formatMoney(subtotal, proposal.currency)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax / charges</span>
                <span className="tabular-nums text-background">
                  {formatMoney(taxAmount, proposal.currency)}
                </span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2 text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatMoney(total, proposal.currency)}
                </span>
              </div>
            </div>
            {pdfUrl ? (
              <Button
                asChild
                variant="outline"
                className="mt-5 w-full border-white/15 bg-white/5 text-background hover:bg-white/10 hover:text-white"
              >
                <a href={pdfUrl} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4" /> Download PDF
                </a>
              </Button>
            ) : null}
          </aside>
        </div>
      </header>

      <section className="grid gap-4 border-b bg-muted/20 px-5 py-5 sm:grid-cols-2 sm:px-8 lg:px-10">
        <PartyBlock icon={Landmark} heading="From" name={sellerName} email={sellerEmail}>
          {seller?.business_phone || seller?.phone ? (
            <p>{seller.business_phone || seller.phone}</p>
          ) : null}
          {formatSellerAddress(seller).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </PartyBlock>
        <PartyBlock icon={UserRound} heading="Prepared for" name={clientName} email={clientEmail}>
          {client?.phone ? <p>{client.phone}</p> : null}
          {client?.billing_address || client?.address ? (
            <p>{client.billing_address || client.address}</p>
          ) : null}
        </PartyBlock>
      </section>

      <section className="space-y-8 px-5 py-8 sm:px-8 lg:px-10">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <SectionPanel eyebrow="Offer" title="What this covers" icon={FileCheck2}>
            <TextBlock value={proposal.scope} empty="Scope will be confirmed before kickoff." />
          </SectionPanel>

          <div className="space-y-4">
            <MiniPanel icon={BadgeCheck} title={guidance.modeLabel}>
              {guidance.publicNote}
            </MiniPanel>
            <MiniPanel icon={ListChecks} title="After acceptance">
              The freelancer can turn this into a contract, project, or invoice without repeating
              the details.
            </MiniPanel>
          </div>
        </div>

        <SectionPanel eyebrow="Pricing" title="Packages and investment" icon={CircleDollarSign}>
          <PricingTable items={items} proposal={proposal} />
        </SectionPanel>

        <div className="grid gap-5 lg:grid-cols-3">
          <SectionPanel eyebrow="Deliverables" title="What you receive" icon={ListChecks}>
            <TextBlock
              value={proposal.deliverables}
              empty="Deliverables will be confirmed before kickoff."
            />
          </SectionPanel>
          <SectionPanel eyebrow="Timeline" title="How the work moves" icon={CalendarDays}>
            <TextBlock value={proposal.timeline} empty="Timeline will be mutually confirmed." />
          </SectionPanel>
          <SectionPanel eyebrow="Terms" title="Commercial terms" icon={FileText}>
            <TextBlock
              value={proposal.terms}
              empty="Commercial terms will be confirmed in writing."
            />
          </SectionPanel>
        </div>

        <NextSteps />
        <AcceptancePanel proposal={proposal} />
      </section>
    </article>
  );
}

function GlanceItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5">{value}</p>
    </div>
  );
}

function PartyBlock({
  icon: Icon,
  heading,
  name,
  email,
  children,
}: {
  icon: LucideIcon;
  heading: string;
  name: string;
  email: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-micro font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {heading}
        </p>
        <p className="mt-1 truncate text-sm font-semibold">{name}</p>
        <div className="mt-1 space-y-0.5 text-xs leading-5 text-muted-foreground">
          {email ? (
            <p className="inline-flex max-w-full items-center gap-1">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{email}</span>
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}

function SectionPanel({
  eyebrow,
  title,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-background p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-micro font-semibold uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">{title}</h3>
        </div>
      </div>
      {children}
    </section>
  );
}

function MiniPanel({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-background p-5 shadow-sm">
      <div className="flex items-center gap-2 font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}

function PricingTable({
  items,
  proposal,
}: {
  items: PublicProposalData["items"];
  proposal: PublicProposalData["proposal"];
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
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
                <span className="text-muted-foreground md:hidden">Amount </span>
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
  );
}

function TextBlock({ value, empty }: { value: string | null; empty: string }) {
  const lines = (value?.trim() || empty)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line));
  const hasOnlyBullets = bulletLines.length > 0 && bulletLines.length === lines.length;

  if (hasOnlyBullets) {
    return (
      <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
        {lines.map((line) => (
          <li key={line} className="flex gap-2">
            <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{line.replace(/^[-*]\s+/, "")}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-3 text-sm leading-7 text-muted-foreground">
      {lines.map((line) =>
        /^[-*]\s+/.test(line) ? (
          <p key={line} className="flex gap-2">
            <CheckCircle2 className="mt-1.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{line.replace(/^[-*]\s+/, "")}</span>
          </p>
        ) : (
          <p key={line}>{line}</p>
        ),
      )}
    </div>
  );
}

function NextSteps() {
  const steps = [
    {
      title: "Accept proposal",
      body: "Confirm that the offer direction, pricing, and scope look good.",
    },
    {
      title: "Prepare next document",
      body: "The freelancer can convert this into a contract, project, or invoice.",
    },
    {
      title: "Kickoff",
      body: "Work begins once the required agreement, payment, or project setup is complete.",
    },
  ];

  return (
    <section className="rounded-2xl border bg-muted/20 p-5">
      <div className="mb-5 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Recommended next steps</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.title} className="rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {index + 1}
              </span>
              {index < steps.length - 1 ? (
                <ArrowRight className="hidden h-4 w-4 text-muted-foreground md:block" />
              ) : null}
            </div>
            <p className="mt-3 text-sm font-semibold">{step.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AcceptancePanel({ proposal }: { proposal: PublicProposalData["proposal"] }) {
  if (proposal.status === "accepted") {
    return (
      <div className="rounded-2xl border border-success-subtle bg-success-subtle p-6 text-sm text-muted-foreground">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-strong" />
          <div>
            <p className="font-semibold text-foreground">Proposal accepted</p>
            <p className="mt-1 leading-6">
              This proposal has been acknowledged. The freelancer can now move it into a
              contract, project, or invoice.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-foreground p-6 text-background shadow-lg shadow-slate-900/10 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xl font-semibold tracking-tight sm:text-2xl">
            Ready to move ahead?
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Accepting lets the freelancer prepare the next step — contract, project, or
            invoice. It takes one click and is not an e-signature contract.
          </p>
        </div>
        <form action={acceptPublicProposalAction} className="shrink-0">
          <input type="hidden" name="token" value={proposal.public_token} />
          <Button
            type="submit"
            size="lg"
            className="w-full bg-white text-foreground shadow-sm hover:bg-muted sm:w-auto sm:px-8"
          >
            <CheckCircle2 className="h-4 w-4" /> Accept proposal
          </Button>
        </form>
      </div>
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
    <div
      className={
        strong
          ? "flex justify-between border-t pt-2 text-base font-bold"
          : "flex justify-between"
      }
    >
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
