"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  BookOpen,
  MoreHorizontal,
  Eye,
  Send,
  Copy,
  Archive,
  Trash2,
  Link2,
} from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

import type { WelcomeDocumentRecord } from "../types";
import { WelcomeStatusBadge } from "./status-badge";
import {
  archiveWelcomeDocumentAction,
  deleteWelcomeDocumentAction,
  duplicateWelcomeDocumentAction,
} from "../actions";
import { sendWelcomeDocumentAction } from "../delivery";
import {
  WELCOME_DOCUMENT_NEW,
  welcomeDocumentDetail,
  getWelcomeShareUrl,
} from "../routes";
import { IvoEntryPoint, openIvo } from "@/features/ai-workflows/components/ivo-entry-point";

type StatusFilter = "all" | "draft" | "published" | "archived";

interface Props {
  documents: WelcomeDocumentRecord[];
  clients: Array<{ id: string; name: string; email: string | null }>;
}

/**
 * Owner-side index for Welcome Documents. Mirrors the contracts list
 * but ditches monetary stats — the metric that matters for an
 * onboarding guide is whether clients have *opened* and
 * *acknowledged* it.
 */
export function WelcomeListView({ documents }: Props) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [, startTransition] = React.useTransition();

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (!term) return true;
      return (
        d.title.toLowerCase().includes(term) ||
        (d.clientName?.toLowerCase().includes(term) ?? false)
      );
    });
  }, [documents, search, statusFilter]);

  const stats = React.useMemo(() => {
    const total = documents.length;
    const published = documents.filter((d) => d.status === "published").length;
    const totalViews = documents.reduce((s, d) => s + d.totalViews, 0);
    return { total, published, totalViews };
  }, [documents]);

  const handleSend = (doc: WelcomeDocumentRecord) => {
    startTransition(async () => {
      const res = await sendWelcomeDocumentAction({ documentId: doc.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const token = res.data?.token;
      if (token) {
        try {
          await navigator.clipboard.writeText(getWelcomeShareUrl(token));
          toast.success("Sent. Share link copied to clipboard.");
        } catch {
          toast.success("Sent.");
        }
      } else {
        toast.success("Sent.");
      }
      router.refresh();
    });
  };

  const handleCopyLink = async (doc: WelcomeDocumentRecord) => {
    if (!doc.publicToken) {
      toast.error("Publish or send the document first to generate a link.");
      return;
    }
    try {
      await navigator.clipboard.writeText(getWelcomeShareUrl(doc.publicToken));
      toast.success("Share link copied.");
    } catch {
      toast.error("Could not copy — try again from the detail page.");
    }
  };

  const handleDuplicate = (doc: WelcomeDocumentRecord) => {
    startTransition(async () => {
      const res = await duplicateWelcomeDocumentAction({ id: doc.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Duplicated as a new draft.");
      router.refresh();
    });
  };

  const handleArchive = (doc: WelcomeDocumentRecord) => {
    startTransition(async () => {
      const res = await archiveWelcomeDocumentAction({ id: doc.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Archived.");
      router.refresh();
    });
  };

  const confirm = useConfirm();

  const handleDelete = async (doc: WelcomeDocumentRecord) => {
    const ok = await confirm({
      title: `Delete "${doc.title}"?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteWelcomeDocumentAction({ id: doc.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Deleted.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Welcome documents"
        description="One personalised guide per client. Duplicate any document to reuse it for the next client."
        actions={
          <div className="flex items-center gap-2">
            <IvoEntryPoint
              prompt="Review my welcome documents and tell me what needs attention."
              label="Ask Ivo"
              variant="outline"
            />
            <IvoEntryPoint
              prompt="Draft a welcome document for a client"
              label="Draft with AI"
              variant="secondary"
            />
            <Button asChild size="sm">
              <Link href={WELCOME_DOCUMENT_NEW}>
                <Plus /> New welcome doc
              </Link>
            </Button>
          </div>
        }
      />

      <div
        className={cn("grid items-start gap-6", "grid-cols-1")}
      >
        <div className="min-w-0 space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total documents" value={stats.total.toString()} />
        <Stat
          label="Published"
          value={stats.published.toString()}
          tone="success"
        />
        <Stat label="Views" value={stats.totalViews.toString()} />
      </div>

      <div className="grid gap-2 sm:flex sm:min-w-0 sm:items-center">
        <div className="relative w-full sm:w-96 sm:shrink-0">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents, clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <div className="w-full sm:w-[160px] sm:shrink-0">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={
            documents.length === 0
              ? "Your first welcome document is one click away"
              : "No documents match your filters"
          }
          description={
            documents.length === 0
              ? "Pick a template — Freelancer Onboarding, Agency Client Welcome, or Consultant Pack — and customise it in minutes."
              : "Try a different search term or status filter."
          }
          action={
            documents.length === 0
              ? { label: "Create welcome doc", href: WELCOME_DOCUMENT_NEW }
              : undefined
          }
          secondaryAction={
            documents.length === 0
              ? {
                  label: "Ask Ivo",
                  onClick: () => openIvo("Help me prepare my first welcome document."),
                }
              : undefined
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {filtered.map((d) => (
                <WelcomeRow
                  key={d.id}
                  doc={d}
                  onSend={() => handleSend(d)}
                  onCopyLink={() => handleCopyLink(d)}
                  onDuplicate={() => handleDuplicate(d)}
                  onArchive={() => handleArchive(d)}
                  onDelete={() => handleDelete(d)}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
        </div>

      </div>
    </div>
  );
}

function WelcomeRow({
  doc,
  onSend,
  onCopyLink,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  doc: WelcomeDocumentRecord;
  onSend: () => void;
  onCopyLink: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const updated = new Date(doc.updatedAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const meta = [
    doc.clientName ?? "Unassigned",
    `${doc.totalViews} ${doc.totalViews === 1 ? "view" : "views"}`,
    updated,
  ].filter(Boolean) as string[];

  return (
    <li>
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-muted/20">
        <Link
          href={welcomeDocumentDetail(doc.id)}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium">{doc.title}</p>
              <WelcomeStatusBadge status={doc.status} />
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {meta.join(" · ")}
            </p>
          </div>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              aria-label="Document actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={welcomeDocumentDetail(doc.id)}>
                <Eye className="h-3.5 w-3.5" /> Open
              </Link>
            </DropdownMenuItem>
            {doc.status !== "archived" && (
              <DropdownMenuItem onSelect={onSend}>
                <Send className="h-3.5 w-3.5" />{" "}
                {doc.status === "draft" ? "Send to client" : "Resend"}
              </DropdownMenuItem>
            )}
            {doc.publicToken && (
              <DropdownMenuItem onSelect={onCopyLink}>
                <Link2 className="h-3.5 w-3.5" /> Copy share link
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={onDuplicate}>
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {doc.status !== "archived" && (
              <DropdownMenuItem onSelect={onArchive}>
                <Archive className="h-3.5 w-3.5" /> Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-5">
        <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={
            "text-2xl font-semibold tabular-nums tracking-tight " +
            (tone === "success"
              ? "text-success"
              : tone === "warning"
                ? "text-warning"
                : "")
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
