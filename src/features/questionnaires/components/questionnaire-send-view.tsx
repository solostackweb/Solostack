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
import { cn } from "@/lib/utils";
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
  const [clientId, setClientId] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [lastLink, setLastLink] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const requestKeyRef = React.useRef<string | null>(null);

  const nameFor = (id: string | null) =>
    clients.find((c) => c.id === id)?.name ?? "Client";

  const send = async () => {
    if (!clientId) {
      toast.error("Pick a client to send to.");
      return;
    }
    setSending(true);
    requestKeyRef.current ??= crypto.randomUUID();
    const res = await sendQuestionnaireAction({
      questionnaireId,
      clientId,
      idempotencyKey: requestKeyRef.current,
    });
    setSending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Sent.");
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
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Client
            </span>
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                requestKeyRef.current = null;
              }}
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Choose a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" onClick={send} disabled={sending}>
            <Send className="h-4 w-4" />
            {sending ? "Sending…" : "Send questionnaire"}
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

  const completed = send.status === "completed";

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{clientName}</p>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
              completed
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
            )}
          >
            {completed ? "Completed" : "Awaiting response"}
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

        {completed ? (
          <details className="group mt-1">
            <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">
              View responses
            </summary>
            <div className="mt-2 space-y-3 border-t pt-3">
              {send.questions.map((q) => {
                const raw = send.responses[q.id];
                const answer = Array.isArray(raw)
                  ? raw.join(", ")
                  : raw === undefined || raw === ""
                    ? "—"
                    : String(raw);
                return (
                  <div key={q.id}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {q.label}
                    </p>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-foreground/90">
                      {answer}
                    </p>
                  </div>
                );
              })}
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
