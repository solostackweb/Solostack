"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { CONTRACT_KIND_LABEL } from "../status";
import { useProfile } from "@/features/profile/context";
import type {
  Contract,
  ContractSection,
  ContractSigner,
} from "../types";

interface ContractPreviewProps {
  /** Lightweight draft-preview shape. */
  contract: Omit<
    Pick<
      Contract,
      "title" | "sections" | "signers" | "value" | "number" | "issuedAt"
    >,
    never
  > & {
    /** DB-aligned kind ("proposal" | "contract"). */
    kind: "proposal" | "contract";
    clientId?: string;
    currency?: string;
  };
  className?: string;
  /** When true, renders with slightly smaller type for a side-by-side preview. */
  compact?: boolean;
}

/**
 * Paper-style contract preview. Centered max-width column, serif heading,
 * numbered sections, signature block. Works as both a viewer on the detail
 * page and a live preview on the builder.
 */
export function ContractPreview({
  contract,
  className,
  compact = false,
}: ContractPreviewProps) {
  // The first signer with role "client" doubles as the "Prepared for" line.
  const recipient = contract.signers.find((s) => s.role === "client") ?? null;
  const issued = new Date(contract.issuedAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <article
      className={cn(
        "mx-auto w-full max-w-3xl rounded-lg border bg-card shadow-sm",
        compact ? "p-8" : "p-10 sm:p-12",
        className,
      )}
    >
      {/* Masthead */}
      <header className="mb-8 flex items-start justify-between gap-4 border-b pb-6">
        <div>
          <p className="text-micro font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {CONTRACT_KIND_LABEL[contract.kind]}
          </p>
          <h1
            className={cn(
              "mt-1 font-semibold tracking-tight",
              compact ? "text-xl" : "text-2xl",
            )}
            style={{ fontFamily: '"Georgia", "Times New Roman", serif' }}
          >
            {contract.title}
          </h1>
          {recipient && (
            <p className="mt-1 text-sm text-muted-foreground">
              Prepared for{" "}
              <span className="font-medium text-foreground">
                {recipient.name}
              </span>
              {recipient.email && <> · {recipient.email}</>}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          <p className="font-mono tabular-nums">{contract.number}</p>
          <p className="mt-0.5 tabular-nums">{issued}</p>
          {contract.value ? (
            <p className="mt-3 text-base font-semibold tabular-nums text-foreground">
              {formatMoney(contract.value, contract.currency)}
            </p>
          ) : null}
        </div>
      </header>

      {/* Body */}
      <div
        className={cn(
          "space-y-6 leading-relaxed",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {contract.sections.map((s, i) => (
          <SectionBlock key={s.id} index={i + 1} section={s} />
        ))}
      </div>

      {/* Signatures */}
      <footer className="mt-10 border-t pt-8">
        <p className="mb-5 text-micro font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Signatures
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          {contract.signers.map((s) => (
            <SignatureBlock key={s.id} signer={s} />
          ))}
        </div>
      </footer>
    </article>
  );
}

function SectionBlock({
  index,
  section,
}: {
  index: number;
  section: ContractSection;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {String(index).padStart(2, "0")}
        </span>
        {section.heading}
      </h2>
      <p className="whitespace-pre-line text-muted-foreground">
        {section.body || (
          <span className="italic text-muted-foreground/60">
            (empty — click to add content)
          </span>
        )}
      </p>
    </section>
  );
}

function SignatureBlock({ signer }: { signer: ContractSigner }) {
  const { profile } = useProfile();
  const signed = signer.status === "signed";
  const freelancerSignatureAvailable =
    signer.role === "freelancer" && Boolean(profile?.signatureType);
  return (
    <div className="space-y-2">
      <p className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
        {signer.role === "client" ? "Client" : "Freelancer"}
      </p>
      <div className="relative flex h-16 items-end border-b">
        {signer.role === "freelancer" && freelancerSignatureAvailable ? (
          profile?.signatureType === "type" && profile.signatureTextValue ? (
            <span
              className="mb-1 text-xl italic"
              style={{
                fontFamily:
                  profile.signatureFontFamily === "great-vibes"
                    ? '"Great Vibes", cursive'
                    : profile.signatureFontFamily === "pacifico"
                      ? '"Pacifico", cursive'
                      : profile.signatureFontFamily === "satisfy"
                        ? '"Satisfy", cursive'
                        : '"Dancing Script", cursive',
              }}
            >
              {profile.signatureTextValue}
            </span>
          ) : profile?.signatureImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.signatureImageUrl}
              alt="Freelancer signature"
              className="mb-1 max-h-12 max-w-full object-contain"
            />
          ) : null
        ) : signed ? (
          <span
            className="mb-1 text-xl italic"
            style={{
              fontFamily: '"Brush Script MT", "Lucida Handwriting", cursive',
            }}
          >
            {signer.name}
          </span>
        ) : (
          <span className="mb-1 text-xs text-muted-foreground/60">
            Awaiting signature
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-xs">
        <div>
          <p className="font-medium">{signer.name}</p>
          <p className="text-muted-foreground">{signer.email}</p>
        </div>
        {signed && signer.signedAt && (
          <p className="text-micro tabular-nums text-muted-foreground">
            Signed {new Date(signer.signedAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
      </div>
    </div>
  );
}
