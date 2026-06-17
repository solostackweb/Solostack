"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  MoreHorizontal,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Save,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/format";
import { getClientInitials } from "@/features/clients/utils";
import { shareOnWhatsApp } from "@/lib/whatsapp";

import type { ContractRecord } from "../server";
import type { ClientRecord } from "@/features/clients/server";
import { CONTRACT_KIND_LABEL } from "../status";
import { ContractStatusBadge } from "./contract-status-badge";
import {
  deleteContractAction,
  duplicateContractAction,
  setContractStatusAction,
  updateContractAction,
} from "../actions";
import { sendContractAction } from "../delivery";
import { ensureContractTokenAction } from "../actions";
import { SignatureMark } from "./signature-mark";
import { useProfile } from "@/features/profile/context";

interface ContractDetailViewProps {
  contract: ContractRecord;
  client: ClientRecord | null;
  clientName: string | null;
}

interface ParsedSection {
  heading: string;
  body: string;
}

function parseSections(content: string | null): {
  sections: ParsedSection[];
  raw: string | null;
} {
  if (!content) return { sections: [], raw: null };
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      const sections = parsed
        .filter(
          (s): s is ParsedSection =>
            !!s && typeof s.heading === "string" && typeof s.body === "string",
        )
        .map((s) => ({ heading: s.heading, body: s.body }));
      if (sections.length > 0) return { sections, raw: null };
    }
  } catch {
    // fall through
  }
  return { sections: [], raw: content };
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ContractDetailView({
  contract,
  client,
  clientName,
}: ContractDetailViewProps) {
  const router = useRouter();
  const { profile } = useProfile();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [sharePending, setSharePending] = React.useState<"copy" | "whatsapp" | null>(null);
  const [, startTransition] = React.useTransition();
  const contractTokenRef = React.useRef<string | null>(contract.publicToken ?? null);

  const { sections, raw } = React.useMemo(
    () => parseSections(contract.content),
    [contract.content],
  );

  // --- Inline content editor ---
  const [editing, setEditing] = React.useState(false);
  const [savingEdits, setSavingEdits] = React.useState(false);
  const [draftTitle, setDraftTitle] = React.useState(contract.title);
  const [draftValue, setDraftValue] = React.useState("");
  const [draftSections, setDraftSections] = React.useState<ParsedSection[]>([]);

  // A signed/declined contract is locked — edits are only allowed before that.
  const canEdit = contract.status !== "signed" && contract.status !== "declined";

  const enterEdit = () => {
    setDraftTitle(contract.title);
    setDraftValue(
      contract.valueAmount != null && contract.valueAmount > 0
        ? String(contract.valueAmount)
        : "",
    );
    setDraftSections(
      sections.length > 0
        ? sections.map((s) => ({ ...s }))
        : [{ heading: "Section 1", body: raw ?? "" }],
    );
    setEditing(true);
  };

  const updateDraftSection = (i: number, patch: Partial<ParsedSection>) =>
    setDraftSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addDraftSection = () =>
    setDraftSections((prev) => [...prev, { heading: "", body: "" }]);
  const removeDraftSection = (i: number) =>
    setDraftSections((prev) => prev.filter((_, idx) => idx !== i));

  const handleSaveEdits = () => {
    if (!draftTitle.trim()) {
      toast.error("Add a title for the contract.");
      return;
    }
    const cleaned = draftSections
      .map((s) => ({ heading: s.heading.trim(), body: s.body.trim() }))
      .filter((s) => s.heading || s.body);
    const fd = new FormData();
    fd.set("id", contract.id);
    fd.set("kind", contract.kind);
    fd.set("title", draftTitle.trim());
    fd.set("content", JSON.stringify(cleaned));
    if (contract.clientId) fd.set("clientId", contract.clientId);
    if (contract.projectId) fd.set("projectId", contract.projectId);
    fd.set("status", contract.status);
    fd.set("currency", contract.currency || "INR");
    // Strip currency symbols / separators so "1,50,000" or "₹1.5L"-style input
    // becomes a clean number; empty clears the value.
    fd.set("valueAmount", draftValue.replace(/[^0-9.]/g, ""));
    if (contract.expiresAt) fd.set("expiresAt", contract.expiresAt);
    setSavingEdits(true);
    startTransition(async () => {
      try {
        const res = await updateContractAction(undefined, fd);
        if (!res.ok) throw new Error(res.error);
        toast.success("Contract updated");
        setEditing(false);
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setSavingEdits(false);
      }
    });
  };

  const isSignable =
    contract.status === "draft" ||
    contract.status === "sent" ||
    contract.status === "viewed";

  const senderName =
    profile?.businessName ?? profile?.legalName ?? profile?.fullName ?? null;

  async function getOrMintContractToken(): Promise<string | null> {
    if (contractTokenRef.current) return contractTokenRef.current;
    const res = await ensureContractTokenAction({ contractId: contract.id });
    if (!res.ok) {
      toast.error(res.error ?? "Could not create share link.");
      return null;
    }
    const token = res.data?.token ?? null;
    contractTokenRef.current = token;
    return token;
  }

  const handleCopyContractLink = async () => {
    setSharePending("copy");
    const token = await getOrMintContractToken();
    setSharePending(null);
    if (!token) return;
    const url = `${window.location.origin}/c/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard.");
    } catch {
      window.open(url, "_blank");
      toast.success("Share link opened in a new tab.");
    }
  };

  const handleWhatsAppContract = async () => {
    setSharePending("whatsapp");
    const token = await getOrMintContractToken();
    setSharePending(null);
    if (!token) return;
    const docType = contract.kind === "contract" ? "contract" : "proposal";
    shareOnWhatsApp({
      phone: client?.phone ?? null,
      clientName,
      documentType: docType,
      documentNumber: contract.title,
      amount:
        contract.valueAmount != null && contract.valueAmount > 0
          ? contract.valueAmount
          : null,
      senderName,
      shareUrl: `${window.location.origin}/c/${token}`,
    });
  };

  const runStatusAction = (action: () => Promise<void>) => {
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  const handleSendForSignature = () => {
    if (!client) {
      toast.error("This contract has no client attached.");
      return;
    }
    if (!client.email?.trim()) {
      toast.error("Add an email to the client before sending.");
      return;
    }
    runStatusAction(async () => {
      const res = await sendContractAction({ contractId: contract.id });
      if (!res.ok) throw new Error(res.error);
      const token = res.data?.token;
      if (!token) {
        toast.success("Sent for signature");
        router.refresh();
        return;
      }
      const shareUrl = `${window.location.origin}/c/${token}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Sent for signature. Share link copied to clipboard.");
      } catch {
        toast.success("Sent for signature");
      }
      router.refresh();
    });
  };

  const handleMark = (status: "signed" | "declined") => {
    const fd = new FormData();
    fd.set("id", contract.id);
    fd.set("status", status);
    runStatusAction(async () => {
      const res = await setContractStatusAction(undefined, fd);
      if (!res.ok) throw new Error(res.error);
      toast.success(`Marked ${status}`);
      router.refresh();
    });
  };

  const handleDelete = () => {
    const fd = new FormData();
    fd.set("id", contract.id);
    runStatusAction(async () => {
      const res = await deleteContractAction(undefined, fd);
      if (!res.ok) throw new Error(res.error);
      toast.success("Contract deleted");
      router.push("/dashboard/contracts");
      router.refresh();
    });
  };

  const handleDuplicate = () => {
    const fd = new FormData();
    fd.set("id", contract.id);
    runStatusAction(async () => {
      const res = await duplicateContractAction(undefined, fd);
      if (!res.ok) throw new Error(res.error);
      toast.success("Duplicated as a draft");
      if (res.data?.id) router.push(`/dashboard/contracts/${res.data.id}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Link href="/dashboard/contracts" aria-label="Back to contracts">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="flex min-w-0 items-center gap-1.5 text-sm">
            <Link
              href="/dashboard/contracts"
              className="hidden shrink-0 text-muted-foreground hover:text-foreground sm:inline"
            >
              Contracts
            </Link>
            <span className="hidden text-muted-foreground/50 sm:inline">/</span>
            <span className="truncate font-medium">{contract.title}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" onClick={handleSaveEdits} disabled={savingEdits}>
                {savingEdits ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save changes
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={savingEdits}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={enterEdit}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
              {isSignable && (
                <Button size="sm" onClick={handleSendForSignature}>
                  <Send /> {contract.status === "draft" ? "Send for signature" : "Resend"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyContractLink}
                disabled={sharePending !== null}
                aria-label="Copy share link"
              >
                {sharePending === "copy" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                Copy link
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-[#25D366]/40 bg-[#25D366]/5 text-[#128C7E] hover:bg-[#25D366]/15 hover:text-[#128C7E] dark:border-[#25D366]/30 dark:bg-[#25D366]/10 dark:text-[#25D366]"
                onClick={handleWhatsAppContract}
                disabled={sharePending !== null}
                aria-label="Share on WhatsApp"
              >
                {sharePending === "whatsapp" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <WhatsAppIcon className="h-3.5 w-3.5 shrink-0" />
                )}
                WhatsApp
              </Button>
              {contract.status !== "signed" && contract.status !== "declined" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMark("signed")}
                >
                  <CheckCircle2 /> Mark signed
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {contract.status !== "declined" && (
                    <DropdownMenuItem onSelect={() => handleMark("declined")}>
                      <XCircle className="h-3.5 w-3.5" /> Mark declined
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => handleDuplicate()}>
                    <Copy className="h-3.5 w-3.5" /> Duplicate as draft
                  </DropdownMenuItem>
                  {contract.status !== "signed" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setDeleteOpen(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete…
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        {/* LEFT — content */}
        <Card>
          <CardContent className="space-y-6 p-5 sm:p-8">
            {editing ? (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Title
                    </label>
                    <Input
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      placeholder="Contract title"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Value (₹)
                    </label>
                    <Input
                      inputMode="decimal"
                      value={draftValue}
                      onChange={(e) => setDraftValue(e.target.value)}
                      placeholder="e.g. 150000"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  {draftSections.map((s, i) => (
                    <div
                      key={i}
                      className="space-y-2 rounded-lg border bg-muted/20 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <Input
                          value={s.heading}
                          onChange={(e) =>
                            updateDraftSection(i, { heading: e.target.value })
                          }
                          placeholder="Section heading"
                          className="h-9 font-medium"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeDraftSection(i)}
                          aria-label="Remove section"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        value={s.body}
                        onChange={(e) =>
                          updateDraftSection(i, { body: e.target.value })
                        }
                        placeholder="Section text…"
                        rows={5}
                        className="resize-y"
                      />
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDraftSection}
                >
                  <Plus className="h-3.5 w-3.5" /> Add section
                </Button>
                <p className="text-xs text-muted-foreground">
                  Edit any wording above — even the smallest change — then click{" "}
                  <span className="font-medium text-foreground">Save changes</span>.
                </p>
              </div>
            ) : (
              <>
            <header className="border-b pb-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {CONTRACT_KIND_LABEL[contract.kind]}
              </p>
              <h1
                className="mt-1 text-2xl font-semibold tracking-tight"
                style={{
                  fontFamily: '"Georgia", "Times New Roman", serif',
                }}
              >
                {contract.title}
              </h1>
              {clientName && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Prepared for{" "}
                  <span className="font-medium text-foreground">
                    {clientName}
                  </span>
                </p>
              )}
            </header>

            {sections.length > 0 ? (
              <div className="space-y-6 text-sm leading-relaxed">
                {sections.map((s, i) => (
                  <section key={i}>
                    <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {s.heading}
                    </h2>
                    <p className="whitespace-pre-line text-muted-foreground">
                      {s.body || (
                        <span className="italic text-muted-foreground/60">
                          (empty)
                        </span>
                      )}
                    </p>
                  </section>
                ))}
              </div>
            ) : raw ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {raw}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                No content yet.
              </p>
            )}

            {contract.kind === "contract" && (
              <section className="border-t pt-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Signature record
                  </p>
                  {contract.status === "signed" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Final signed document
                    </span>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DashboardSignatureBlock
                    role="Freelancer"
                    name={
                      profile?.legalName ??
                      profile?.businessName ??
                      profile?.fullName ??
                      "Freelancer"
                    }
                    email={profile?.businessEmail ?? profile?.email}
                    signedAt={profile?.signatureUpdatedAt ?? contract.createdAt}
                    signature={{
                      type: profile?.signatureType ?? null,
                      imageUrl: profile?.signatureImageUrl,
                      textValue: profile?.signatureTextValue,
                      fontFamily: profile?.signatureFontFamily,
                    }}
                    fallback="Signature on file"
                  />
                  <DashboardSignatureBlock
                    role="Client"
                    name={clientName ?? "Client"}
                    email={client?.email}
                    signedAt={contract.signedAt}
                    signature={{
                      type: contract.signatureType,
                      imageUrl: contract.signatureImageUrl,
                      textValue: contract.signatureTextValue,
                      fontFamily: contract.signatureFontFamily,
                    }}
                    fallback="Awaiting signature"
                  />
                </div>
              </section>
            )}
              </>
            )}
          </CardContent>
        </Card>

        {/* RIGHT — metadata */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-4 p-5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </p>
                  <div className="mt-1">
                    <ContractStatusBadge status={contract.status} />
                  </div>
                </div>
                {contract.valueAmount != null && contract.valueAmount > 0 && (
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Value
                    </p>
                    <p className="mt-1 text-base font-semibold tabular-nums">
                      {formatINR(contract.valueAmount)}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2 border-t pt-3">
                <MetaRow
                  label="Kind"
                  value={CONTRACT_KIND_LABEL[contract.kind]}
                />
                {client && (
                  <MetaRow
                    label="Client"
                    value={
                      <Link
                        href={`/dashboard/clients/${client.id}`}
                        className="inline-flex items-center gap-2 hover:underline"
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[9px]">
                            {getClientInitials(clientName ?? "")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{clientName}</span>
                      </Link>
                    }
                  />
                )}
                <MetaRow label="Created" value={formatDate(contract.createdAt)} />
                {contract.sentAt && (
                  <MetaRow label="Sent" value={formatDate(contract.sentAt)} />
                )}
                {contract.viewedAt && (
                  <MetaRow
                    label="Viewed"
                    value={formatDate(contract.viewedAt)}
                  />
                )}
                {contract.signedAt && (
                  <MetaRow
                    label="Signed"
                    value={formatDate(contract.signedAt)}
                  />
                )}
                {contract.expiresAt && (
                  <MetaRow
                    label="Expires"
                    value={formatDate(contract.expiresAt)}
                  />
                )}
                {contract.projectId && (
                  <MetaRow
                    label="Project"
                    value={
                      <Link
                        href={`/dashboard/projects/${contract.projectId}`}
                        className="hover:underline"
                      >
                        View
                      </Link>
                    }
                  />
                )}
                {contract.publicToken && (
                  <MetaRow
                    label="Sign URL"
                    value={
                      <code className="truncate font-mono text-[11px] text-muted-foreground">
                        /c/{contract.publicToken}
                      </code>
                    }
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this contract?"
        description="This will permanently remove the contract from your workspace. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}

function DashboardSignatureBlock({
  role,
  name,
  email,
  signedAt,
  signature,
  fallback,
}: {
  role: string;
  name: string;
  email?: string | null;
  signedAt?: string | null;
  signature: React.ComponentProps<typeof SignatureMark>["signature"];
  fallback: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {role}
      </p>
      <div className="mt-4 flex h-20 items-end border-b border-dashed pb-2">
        <SignatureMark
          signature={signature}
          fallbackName={fallback}
          alt={`${role} signature`}
        />
      </div>
      <div className="mt-3 text-sm">
        <p className="font-semibold">{name}</p>
        {email && <p className="text-xs text-muted-foreground">{email}</p>}
        {signedAt && (
          <p className="mt-1 text-xs text-success">
            Signed on {formatDate(signedAt)}
          </p>
        )}
      </div>
    </div>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 text-xs")}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-sm">{value}</span>
    </div>
  );
}
