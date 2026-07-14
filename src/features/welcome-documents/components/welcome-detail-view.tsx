"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Eye,
  Download,
  Link2,
  Pencil,
  PencilOff,
  Clock,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { PageHeader } from "@/components/shared/page-header";

import type { WelcomeDocumentRecord } from "../types";
import { WelcomeMarkdown } from "../markdown";
import { WelcomeStatusBadge } from "./status-badge";
import { WelcomeEditor } from "./welcome-editor";
import {
  publishWelcomeDocumentAction,
  saveAsTemplateAction,
} from "../actions";
import { sendWelcomeDocumentAction } from "../delivery";
import {
  WELCOME_DOCUMENTS_INDEX,
  welcomeDocumentPdf,
  getWelcomeShareUrl,
} from "../routes";

interface ClientOption {
  id: string;
  name: string;
  email: string | null;
}

interface Props {
  doc: WelcomeDocumentRecord;
  clients: ClientOption[];
}

export function WelcomeDetailView({ doc, clients }: Props) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [tplOpen, setTplOpen] = React.useState(false);
  const [, startTransition] = React.useTransition();

  const shareUrl = doc.publicToken
    ? getWelcomeShareUrl(doc.publicToken)
    : null;

  const onCopyLink = async () => {
    if (!shareUrl) {
      toast.error("Publish or send the document to generate a link.");
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied.");
    } catch {
      toast.error("Could not copy.");
    }
  };

  const onPublish = () => {
    startTransition(async () => {
      const res = await publishWelcomeDocumentAction({ id: doc.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Published.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={doc.title}
        description={metaLine(doc)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={WELCOME_DOCUMENTS_INDEX}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? (
                <>
                  <PencilOff className="h-3.5 w-3.5" /> Done editing
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </>
              )}
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={welcomeDocumentPdf(doc.id)} target="_blank" rel="noreferrer">
                <Download className="h-3.5 w-3.5" /> PDF
              </a>
            </Button>
            {shareUrl && (
              <Button variant="outline" size="sm" onClick={onCopyLink}>
                <Link2 className="h-3.5 w-3.5" /> Copy link
              </Button>
            )}
            {doc.status === "draft" && (
              <Button variant="outline" size="sm" onClick={onPublish}>
                Publish
              </Button>
            )}
            <Button size="sm" onClick={() => setSendOpen(true)}>
              <Send className="h-3.5 w-3.5" />{" "}
              {doc.status === "draft" ? "Send" : "Resend"}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <WelcomeStatusBadge status={doc.status} />
        {doc.publicToken && (
          <a
            href={shareUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Eye className="h-3 w-3" /> View as client
          </a>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid gap-3 sm:grid-cols-2">
        <StatPill
          icon={Eye}
          label="Views"
          value={`${doc.totalViews} (${doc.uniqueViewers} unique)`}
        />
        <StatPill
          icon={Clock}
          label="Last updated"
          value={new Date(doc.updatedAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        />
      </div>

      {editing ? (
        <WelcomeEditor
          mode="edit"
          documentId={doc.id}
          clients={clients}
          initial={{
            title: doc.title,
            intro: doc.intro ?? "",
            sections: doc.sections,
            clientId: doc.clientId,
            projectId: doc.projectId,
            brandColor: doc.brandColor,
          }}
        />
      ) : (
        <Card>
          <CardContent className="space-y-8 p-6 sm:p-8">
            {doc.intro && (
              <div className="rounded-md border-l-2 border-primary/40 bg-muted/30 p-4 text-sm leading-relaxed text-foreground/90">
                <WelcomeMarkdown source={doc.intro} />
              </div>
            )}
            {doc.sections.map((section, i) => (
              <section key={section.id} className="space-y-2">
                <h2 className="text-base font-semibold tracking-tight">
                  {i + 1}. {section.heading}
                </h2>
                <WelcomeMarkdown source={section.body} />
              </section>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTplOpen(true)}
          className="text-muted-foreground"
        >
          <Bookmark className="h-3.5 w-3.5" /> Save as template
        </Button>
      </div>

      <SendDialog
        doc={doc}
        clients={clients}
        open={sendOpen}
        onOpenChange={setSendOpen}
        onSent={() => router.refresh()}
      />
      <SaveAsTemplateDialog
        doc={doc}
        open={tplOpen}
        onOpenChange={setTplOpen}
      />
    </div>
  );
}

function metaLine(doc: WelcomeDocumentRecord): string {
  const parts: string[] = [];
  if (doc.clientName) parts.push(doc.clientName);
  if (doc.publishedAt) {
    parts.push(
      `Published ${new Date(doc.publishedAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}`,
    );
  } else {
    parts.push("Draft");
  }
  return parts.join(" · ");
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="truncate text-sm font-medium">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SendDialog({
  doc,
  clients,
  open,
  onOpenChange,
  onSent,
}: {
  doc: WelcomeDocumentRecord;
  clients: ClientOption[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent: () => void;
}) {
  const router = useRouter();
  const linkedEmail =
    clients.find((c) => c.id === doc.clientId)?.email ?? "";
  const [toEmail, setToEmail] = React.useState(linkedEmail);
  const [message, setMessage] = React.useState("");
  const [ccSelf, setCcSelf] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) setToEmail(linkedEmail);
  }, [open, linkedEmail]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await sendWelcomeDocumentAction({
        documentId: doc.id,
        toEmail: toEmail.trim() || undefined,
        message: message.trim() || undefined,
        ccSelf,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Sent.");
      onOpenChange(false);
      onSent();
      router.refresh();
    });
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Send to client"
      description="We'll email a friendly note with a link and the PDF attached."
    >
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="wd-send-email" className="text-xs">
              To
            </Label>
            <Input
              id="wd-send-email"
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="client@example.com"
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="wd-send-msg" className="text-xs">
              Personal note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="wd-send-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              className="mt-1.5"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <Switch checked={ccSelf} onCheckedChange={setCcSelf} />
            CC me on this email
          </label>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
    </ResponsiveModal>
  );
}

function SaveAsTemplateDialog({
  doc,
  open,
  onOpenChange,
}: {
  doc: WelcomeDocumentRecord;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [title, setTitle] = React.useState(doc.title);
  const [description, setDescription] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Give the template a title.");
      return;
    }
    startTransition(async () => {
      const res = await saveAsTemplateAction({
        id: doc.id,
        templateTitle: title.trim(),
        templateDescription: description.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Saved as template.");
      onOpenChange(false);
    });
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Save as template"
      description="You'll see this in your template grid the next time you create a welcome document."
    >
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="wd-tpl-title" className="text-xs">
              Template title
            </Label>
            <Input
              id="wd-tpl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="wd-tpl-desc" className="text-xs">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="wd-tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className="mt-1.5"
            />
          </div>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save template"}
            </Button>
          </div>
        </form>
    </ResponsiveModal>
  );
}
