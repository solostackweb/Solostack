"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Send,
  Eye,
  GripVertical,
  CircleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { getClientDisplayName } from "@/features/clients/utils";
import type { ClientRecord } from "@/features/clients/server";
import { InternationalComplianceNote } from "@/features/invoices/components/international-compliance-note";
import type { ProjectRecord } from "@/features/projects/server";
import type { ContractKindRow } from "@/lib/supabase/types";
import { useProfile } from "@/features/profile/context";
import { getDisplayName } from "@/features/profile/utils";
import { CONTRACT_KIND_LABEL, CONTRACT_KINDS } from "../status";
import type {
  ContractSection,
  ContractTemplate,
} from "../types";
import { contractTemplates } from "../templates";
import { createContractAction } from "../actions";
import { sendContractAction } from "../delivery";
import { TemplatePicker } from "./template-picker";
import { ContractPreview } from "./contract-preview";
import type { AiContractDraft } from "@/features/ai-workflows/types";

type Step = "template" | "build";
const PLACEHOLDER_PATTERN = /\[[^\]\n]{2,80}\]/;

function newSectionId() {
  return `s_${Math.random().toString(36).slice(2, 9)}`;
}

function replaceKnownPlaceholders(
  value: string,
  replacements: Record<string, string | null | undefined>,
) {
  return value.replace(/\[([^\]\n]{2,80})\]/g, (match, rawKey: string) => {
    const replacement = replacements[rawKey.trim().toLowerCase()];
    return replacement && replacement.trim() ? replacement : match;
  });
}

function buildContractPlaceholderReplacements(args: {
  clientName: string | null;
  clientBusinessName: string | null;
  projectName: string | null;
  freelancerName: string | null;
  freelancerLegalName: string | null;
  contractValue: string | null;
}) {
  const {
    clientName,
    clientBusinessName,
    projectName,
    freelancerName,
    freelancerLegalName,
    contractValue,
  } = args;
  const clientOrBusiness = clientBusinessName || clientName;
  const projectOrClient = projectName || clientOrBusiness;
  return {
    "client name": clientName,
    "client legal name": clientOrBusiness,
    "client/business name": clientOrBusiness,
    "client/project name": projectOrClient,
    "party two legal name": clientOrBusiness,
    "project name": projectName,
    "project/opportunity": projectName,
    "freelancer/business name": freelancerLegalName || freelancerName,
    "freelancer/business legal name": freelancerLegalName || freelancerName,
    "party one legal name": freelancerLegalName || freelancerName,
    "currency and amount": contractValue,
    amount: contractValue,
  } satisfies Record<string, string | null | undefined>;
}

/**
 * Two-step contract builder:
 *   1. Pick a template (or blank)
 *   2. Fill in details on the left, live-preview on the right
 *
 * On mobile, the preview collapses to a tab below the editor. On desktop,
 * both panes are visible side-by-side.
 */
interface ContractBuilderViewProps {
  clients: ClientRecord[];
  projects: ProjectRecord[];
}

export function ContractBuilderView({
  clients,
  projects,
}: ContractBuilderViewProps) {
  const router = useRouter();
  const { profile } = useProfile();
  const [step, setStep] = React.useState<Step>("template");

  // Form state
  const [template, setTemplate] = React.useState<ContractTemplate | null>(null);
  const [title, setTitle] = React.useState("");
  const [kind, setKind] = React.useState<ContractKindRow>("contract");
  const [clientId, setClientId] = React.useState<string>("");
  const [projectId, setProjectId] = React.useState<string>("");
  const [value, setValue] = React.useState<number | "">("");
  const [sections, setSections] = React.useState<ContractSection[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [mobileTab, setMobileTab] = React.useState<"edit" | "preview">("edit");

  const projectOptions = React.useMemo(
    () =>
      clientId
        ? projects.filter((p) => p.clientId === clientId)
        : projects,
    [projects, clientId],
  );
  const client = clients.find((c) => c.id === clientId) ?? null;
  const project = projects.find((p) => p.id === projectId) ?? null;
  const selectedCurrency = (client?.currency || "INR").toUpperCase();

  const handlePickTemplate = (t: ContractTemplate) => {
    setTemplate(t);
    // The DB only knows two kinds; map proposal-likes to proposal.
    setKind(t.kind === "proposal" ? "proposal" : "contract");
    setSections(
      t.sections.map((s) => ({ ...s, id: newSectionId() })),
    );
    setTitle(t.name);
    setStep("build");
  };

  const updateSection = (id: string, patch: Partial<ContractSection>) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  };

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      { id: newSectionId(), heading: "New section", body: "" },
    ]);
  };

  const removeSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  const moveSection = (id: string, dir: "up" | "down") => {
    setSections((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const j = dir === "up" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const applyAiDraft = React.useCallback((draft: AiContractDraft) => {
    setTemplate(null);
    setTitle(draft.title);
    setKind(draft.kind);
    setClientId(draft.clientId ?? "");
    setProjectId(draft.projectId ?? "");
    setValue(draft.valueAmount ?? "");
    setSections(
      draft.sections.map((section) => ({
        id: newSectionId(),
        heading: section.heading,
        body: section.body,
      })),
    );
    setStep("build");
    setMobileTab("preview");
  }, []);

  React.useEffect(() => {
    const stored = window.sessionStorage.getItem("stackivo.ai.contractDraft");
    if (!stored) return;
    try {
      const draft = JSON.parse(stored) as AiContractDraft;
      applyAiDraft(draft);
      window.sessionStorage.removeItem("stackivo.ai.contractDraft");
    } catch {
      window.sessionStorage.removeItem("stackivo.ai.contractDraft");
    }
  }, [applyAiDraft]);

  const persist = async (status: "draft" | "sent") => {
    const safeTitle = title.trim() || template?.name || "Untitled contract";
    if (status === "sent") {
      if (!client) {
        toast.error("Select a client before sending.");
        return;
      }
      if (!client.email?.trim()) {
        toast.error("Add an email to the selected client before sending.");
        return;
      }
      if (hasUnresolvedPlaceholders(title, sections)) {
        toast.error(
          "Review the template placeholders before sending. Replace bracketed text like [date], [amount], or [client name].",
        );
        return;
      }
    }
    setSubmitting(true);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("title", safeTitle);
    fd.set(
      "content",
      JSON.stringify(
        sections.map((s) => ({ heading: s.heading, body: s.body })),
      ),
    );
    if (clientId) fd.set("clientId", clientId);
    if (projectId) fd.set("projectId", projectId);
    fd.set("status", status);
    fd.set("currency", selectedCurrency);
    if (value !== "") fd.set("valueAmount", String(value));
    const res = await createContractAction(undefined, fd);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    if (status === "sent") {
      const contractId = res.data?.id;
      if (!contractId) {
        toast.error("Could not create contract.");
        return;
      }

      const sendRes = await sendContractAction({ contractId });
      if (!sendRes.ok) {
        toast.error(sendRes.error);
        router.push(`/dashboard/contracts/${contractId}`);
        router.refresh();
        return;
      }

      const token = sendRes.data?.token;
      if (!token) {
        toast.success("Sent for signature.");
        return;
      }

      const shareUrl = shareUrlForToken(token);
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Sent for signature. Share link copied to clipboard.");
      } catch {
        toast.success("Sent for signature.");
      }
    }

    toast.success(status === "sent" ? "Sent for signature" : "Draft saved");
    router.push(
      res.data?.id ? `/dashboard/contracts/${res.data.id}` : "/dashboard/contracts",
    );
    router.refresh();
  };

  const handleSaveDraft = () => persist("draft");
  const handleSendForSignature = () => persist("sent");

  const shareUrlForToken = (token: string) => {
    if (typeof window === "undefined") return `/c/${token}`;
    return `${window.location.origin}/c/${token}`;
  };

  const clientDisplayName = client ? getClientDisplayName(client) : null;
  const freelancerName = getDisplayName(profile) || profile?.fullName || "";
  const placeholderReplacements = React.useMemo(
    () =>
      buildContractPlaceholderReplacements({
        clientName: clientDisplayName,
        clientBusinessName: client?.businessName ?? null,
        projectName: project?.name ?? null,
        freelancerName,
        freelancerLegalName: profile?.legalName || profile?.businessName || null,
        contractValue: value === "" ? null : formatMoney(Number(value), selectedCurrency),
      }),
    [
      clientDisplayName,
      client?.businessName,
      project?.name,
      freelancerName,
      profile?.legalName,
      profile?.businessName,
      value,
      selectedCurrency,
    ],
  );

  React.useEffect(() => {
    setTitle((prev) => {
      const next = replaceKnownPlaceholders(prev, placeholderReplacements);
      return next === prev ? prev : next;
    });
    setSections((prev) => {
      let changed = false;
      const next = prev.map((section) => {
        const heading = replaceKnownPlaceholders(section.heading, placeholderReplacements);
        const body = replaceKnownPlaceholders(section.body, placeholderReplacements);
        if (heading !== section.heading || body !== section.body) changed = true;
        return changed && (heading !== section.heading || body !== section.body)
          ? { ...section, heading, body }
          : section;
      });
      return changed ? next : prev;
    });
  }, [placeholderReplacements]);

  const previewData = {
    title: title || "Untitled contract",
    kind,
    sections,
    signers: [
      ...(freelancerName
        ? [
            {
              id: "sg_freelancer",
              name: freelancerName,
              email: profile?.email ?? "",
              role: "freelancer" as const,
              status: "pending" as const,
            },
          ]
        : []),
      ...(clientDisplayName
        ? [
            {
              id: "sg_client",
              name: clientDisplayName,
              email: client?.email ?? "",
              role: "client" as const,
              status: "pending" as const,
            },
          ]
        : []),
    ],
    value: value === "" ? undefined : Number(value),
    currency: selectedCurrency,
    number: "DRAFT",
    issuedAt: new Date().toISOString().slice(0, 10),
    clientId: clientId || undefined,
  };

  // -------- STEP 1: template picker --------
  if (step === "template") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link href="/dashboard/contracts" aria-label="Back">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              New contract
            </h1>
            <p className="text-sm text-muted-foreground">
              Start from a polished template or a blank document.
            </p>
          </div>
        </div>

        <TemplatePicker
          templates={contractTemplates}
          onSelect={handlePickTemplate}
        />
      </div>
    );
  }

  // -------- STEP 2: editor + preview --------
  return (
    <div className="space-y-4">
      {client?.isForeign ? (
        <InternationalComplianceNote variant="contract" />
      ) : null}
      {/* Sticky action bar */}
      <div className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/80 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep("template")}
        >
          <ArrowLeft /> Change template
        </Button>
        <div className="min-w-0 text-xs text-muted-foreground">
          <span className="hidden sm:inline">
            Template: {template?.name ?? "Blank"}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={submitting}
          >
            <Save /> Save draft
          </Button>
          <Button
            size="sm"
            onClick={handleSendForSignature}
            disabled={submitting}
          >
            <Send /> Send for signature
          </Button>
        </div>
      </div>

      {/* Mobile tab toggle */}
      <div className="flex rounded-md bg-muted p-0.5 lg:hidden">
        <MobileTab
          active={mobileTab === "edit"}
          onClick={() => setMobileTab("edit")}
          label="Edit"
        />
        <MobileTab
          active={mobileTab === "preview"}
          onClick={() => setMobileTab("preview")}
          icon={Eye}
          label="Preview"
        />
      </div>

      {template && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Review this template before sending</p>
            <p className="text-xs leading-5 text-amber-900/80 dark:text-amber-100/80">
              Replace all bracketed placeholders, check names, dates, fees, scope,
              payment terms, and revision limits. You can save a draft anytime,
              but sending is blocked while bracketed placeholders remain.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* EDITOR */}
        <div
          className={cn(
            "space-y-4",
            mobileTab === "preview" && "hidden lg:block",
          )}
        >
          <Card>
            <CardContent className="space-y-4 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Details
              </p>
              <Field label="Title">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Website redesign proposal"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Kind">
                  <Select
                    value={kind}
                    onValueChange={(v) => setKind(v as ContractKindRow)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {CONTRACT_KIND_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={`Value (${selectedCurrency})`}>
                  <Input
                    type="number"
                    min="0"
                    value={value}
                    onChange={(e) =>
                      setValue(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="tabular-nums"
                    placeholder={
                      value === ""
                        ? "Optional"
                        : formatMoney(Number(value), selectedCurrency)
                    }
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Client">
                  <Select
                    value={clientId}
                    onValueChange={(v) => {
                      setClientId(v);
                      setProjectId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client…" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          No clients yet — add one first.
                        </div>
                      )}
                      {clients.map((c) => {
                        const name = getClientDisplayName(c);
                        return (
                          <SelectItem key={c.id} value={c.id}>
                            {name}
                            {c.businessName && c.businessName !== name && (
                              <> · {c.businessName}</>
                            )}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Project (optional)">
                  <Select
                    value={projectId}
                    onValueChange={setProjectId}
                    disabled={!clientId || projectOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !clientId
                            ? "Choose a client first"
                            : projectOptions.length === 0
                              ? "No projects for this client"
                              : "None"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {projectOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sections
                </p>
                <Button variant="ghost" size="sm" onClick={addSection}>
                  <Plus /> Add section
                </Button>
              </div>

              {sections.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  No sections yet — click &ldquo;Add section&rdquo; to get started.
                </p>
              ) : (
                <ul className="space-y-3">
                  {sections.map((s, i) => (
                    <li
                      key={s.id}
                      className="rounded-md border bg-background p-3"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="Drag to reorder"
                          className="cursor-grab text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            // For keyboard accessibility — move up.
                            moveSection(s.id, "up");
                          }}
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <Input
                          value={s.heading}
                          onChange={(e) =>
                            updateSection(s.id, { heading: e.target.value })
                          }
                          placeholder="Section heading"
                          className="h-8 flex-1 border-transparent bg-transparent px-2 font-medium shadow-none focus-visible:border-input focus-visible:bg-background"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeSection(s.id)}
                          aria-label="Remove section"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Textarea
                        value={s.body}
                        onChange={(e) =>
                          updateSection(s.id, { body: e.target.value })
                        }
                        rows={4}
                        placeholder="Section content…"
                        className="mt-2 resize-none"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* PREVIEW */}
        <div
          className={cn(
            "lg:sticky lg:top-32 lg:self-start",
            mobileTab === "edit" && "hidden lg:block",
          )}
        >
          <ContractPreview contract={previewData} compact />
        </div>
      </div>

    </div>
  );
}

function MobileTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon?: typeof Eye;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function hasUnresolvedPlaceholders(
  title: string,
  sections: ContractSection[],
): boolean {
  return [title, ...sections.flatMap((section) => [section.heading, section.body])]
    .some((value) => PLACEHOLDER_PATTERN.test(value));
}
