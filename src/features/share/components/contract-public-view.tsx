import * as React from "react";
import { CheckCircle2, Clock3, FileText, ShieldCheck } from "lucide-react";
import type { ContractPdfData } from "@/features/documents/pdf/contract-pdf";
import { SignatureMark } from "@/features/contracts/components/signature-mark";
import { parseContractContent } from "@/features/contracts/content";
import { hasSignatureReference } from "@/features/contracts/signatures";
import { clientFacingContractStatus } from "@/features/contracts/status";
import { cn } from "@/lib/utils";

interface Props {
  data: ContractPdfData;
}

export function ContractPublicView({ data }: Props) {
  const label = data.kind === "proposal" ? "Proposal" : "Contract";
  const parsedContent = parseContractContent(data.content);
  const isSigned = data.status === "signed";

  return (
    <article className="overflow-hidden bg-card">
      <header className="border-b bg-gradient-to-b from-muted/50 to-background px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                {label}
              </span>
              <StatusPill signed={isSigned} status={data.status} />
            </div>
            <div>
              <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                {data.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Prepared by {data.seller.businessName} for {data.client.name}.
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-start gap-3 rounded-lg border bg-background/80 p-3 shadow-sm">
            {data.seller.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.seller.logoDataUrl}
                alt={`${data.seller.businessName} logo`}
                className="h-11 w-11 rounded-md object-contain"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                {data.seller.businessName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 text-sm">
              <p className="truncate font-semibold">{data.seller.businessName}</p>
              {data.seller.legalName && (
                <p className="truncate text-xs text-muted-foreground">
                  {data.seller.legalName}
                </p>
              )}
              {data.seller.email && (
                <p className="truncate text-xs text-muted-foreground">
                  {data.seller.email}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Meta label="Issued" value={formatDate(data.issuedAt)} />
          <Meta label="Status" value={isSigned ? "Signed and locked" : "Awaiting signature"} />
          {data.valueAmount !== null ? (
            <Meta
              label="Value"
              value={formatCurrency(data.valueAmount, data.currency)}
            />
          ) : (
            <Meta label="Expires" value={data.expiresAt ? formatDate(data.expiresAt) : "No expiry"} />
          )}
        </div>
      </header>

      <section className="grid gap-3 border-b px-5 py-5 sm:grid-cols-2 sm:px-8">
        <Party heading="Freelancer" name={data.seller.businessName}>
          {data.seller.addressLines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </Party>
        <Party heading="Client" name={data.client.name}>
          {data.client.detailLines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </Party>
      </section>

      <section className="px-5 py-7 sm:px-8 sm:py-9">
        <div className="mx-auto max-w-3xl space-y-6 text-sm leading-7">
          {parsedContent.sections.length > 0
            ? parsedContent.sections.map((section, i) => (
                <section key={i} className="space-y-2">
                  <h3 className="flex items-baseline gap-3 text-base font-semibold tracking-tight">
                    <span className="font-mono text-xs text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {section.heading}
                  </h3>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {section.body}
                  </p>
                </section>
              ))
            : parsedContent.paragraphs.map((p, i) => (
                <p key={i} className="whitespace-pre-wrap text-muted-foreground">
                  {p}
                </p>
              ))}
        </div>
      </section>

      {data.kind === "contract" && (
        <section className="border-t bg-muted/20 px-5 py-6 sm:px-8">
          <div className="mb-5 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-success" />
            Signature record
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SignatureBlock
              label="Freelancer"
              partyName={data.seller.signature?.legalName ?? data.seller.legalName ?? data.seller.businessName}
              email={data.seller.email}
              signedAt={data.seller.signature?.signedAt ?? data.issuedAt}
              signature={data.seller.signature}
              fallback="Signature on file"
            />
            <SignatureBlock
              label="Client"
              partyName={data.clientSignature?.legalName ?? data.signerName ?? data.client.name}
              email={data.clientSignature?.signerEmail ?? data.signerEmail}
              signedAt={data.clientSignature?.signedAt ?? data.signedAt}
              signature={data.clientSignature}
              fallback="Awaiting signature"
            />
          </div>
        </section>
      )}
    </article>
  );
}

function StatusPill({ signed, status }: { signed: boolean; status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize",
        signed ? "bg-success/10 text-success" : "bg-amber-500/10 text-amber-700",
      )}
    >
      {signed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
      {clientFacingContractStatus(status)}
    </span>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium tabular-nums">{value}</p>
    </div>
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

function SignatureBlock({
  label,
  partyName,
  email,
  signedAt,
  signature,
  fallback,
}: {
  label: string;
  partyName: string;
  email?: string | null;
  signedAt?: string | null;
  signature: ContractPdfData["clientSignature"] | ContractPdfData["seller"]["signature"];
  fallback: string;
}) {
  const signed = hasSignatureReference(signature);

  return (
    <div className="rounded-lg border bg-background p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-4 flex h-20 items-end border-b border-dashed pb-2">
        <SignatureMark
          signature={signature}
          fallbackName={fallback}
          alt={`${label} signature`}
        />
      </div>
      <div className="mt-3 flex flex-col gap-1 text-sm">
        <p className="font-semibold">{partyName}</p>
        {email && <p className="text-xs text-muted-foreground">{email}</p>}
        <p className={cn("text-xs", signed ? "text-success" : "text-muted-foreground")}>
          {signed && signedAt ? `Signed on ${formatDate(signedAt)}` : fallback}
        </p>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
