"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, Send } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { sendQuestionnaireAction } from "../actions";
import type { QuestionnaireSend } from "../types";

interface ClientOption {
  id: string;
  name: string;
}

export function QuestionnaireSendView({
  questionnaireId,
  questionnaireTitle,
  clients,
  sends,
}: {
  questionnaireId: string;
  questionnaireTitle: string;
  clients: ClientOption[];
  sends: QuestionnaireSend[];
}) {
  const router = useRouter();
  const [sending, setSending] = React.useState(false);
  const [lastLink, setLastLink] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const requestKeyRef = React.useRef<string | null>(null);

  const nameFor = (id: string | null) =>
    clients.find((c) => c.id === id)?.name ?? "Public collection link";

  const send = async () => {
    setSending(true);
    requestKeyRef.current ??= crypto.randomUUID();
    const res = await sendQuestionnaireAction({
      questionnaireId,
      idempotencyKey: requestKeyRef.current,
    });
    setSending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Link ready.");
    setLastLink(`${window.location.origin}/q/${res.data?.publicToken ?? ""}`);
    router.refresh();
  };

  const copyLink = async () => {
    if (!lastLink) return;
    await navigator.clipboard.writeText(lastLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Send questionnaire"
        description={questionnaireTitle}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/questionnaires">
              <ArrowLeft className="h-4 w-4" /> Questionnaires
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="text-sm leading-6 text-muted-foreground">
            Create one reusable public link. Every response records the respondent&apos;s required name and email.
          </p>
          <Button type="button" onClick={send} disabled={sending}>
            <Send className="h-4 w-4" />
            {sending ? "Creating…" : "Create public link"}
          </Button>
          {lastLink ? (
            <div className="flex items-center gap-2">
              <Input readOnly value={lastLink} className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={copyLink}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {sends.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Sent
          </h2>
          {sends.map((s) => (
            <SendCard key={s.id} send={s} clientName={nameFor(s.clientId)} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function SendCard({
  send,
  clientName,
}: {
  send: QuestionnaireSend;
  clientName: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/q/${send.publicToken}`
      : `/q/${send.publicToken}`;

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{clientName}</p>
          <span className="rounded-full bg-info-subtle px-2 py-0.5 text-micro font-semibold text-info-strong">
            Active link
          </span>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy link"}
        </Button>
      </CardContent>
    </Card>
  );
}
