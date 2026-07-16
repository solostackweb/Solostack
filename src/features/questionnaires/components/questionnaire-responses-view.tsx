"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, MessageCircle } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { QuestionnaireSend } from "../types";
import {
  SendQuestionnaireDialog,
  buildWhatsappHref,
  type SendClientOption,
} from "./send-questionnaire-dialog";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function QuestionnaireResponsesView({
  questionnaireId,
  questionnaireTitle,
  clients,
  sends,
}: {
  questionnaireId: string;
  questionnaireTitle: string;
  clients: SendClientOption[];
  sends: QuestionnaireSend[];
}) {
  const clientFor = (id: string | null) => clients.find((c) => c.id === id);
  const completed = sends.filter((s) => s.status === "completed").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Responses"
        description={questionnaireTitle}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/questionnaires">
                <ArrowLeft className="h-4 w-4" /> Questionnaires
              </Link>
            </Button>
            <SendQuestionnaireDialog
              questionnaireId={questionnaireId}
              clients={clients}
            />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Sent" value={sends.length} />
        <Stat label="Completed" value={completed} />
      </div>

      {sends.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Not sent to anyone yet. Use “Send” to share it with a client.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sends.map((send) => (
            <ResponseCard
              key={send.id}
              send={send}
              client={clientFor(send.clientId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function ResponseCard({
  send,
  client,
}: {
  send: QuestionnaireSend;
  client?: SendClientOption;
}) {
  const [copied, setCopied] = React.useState(false);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/q/${send.publicToken}`
      : `/q/${send.publicToken}`;
  const completed = send.status === "completed";

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{client?.name ?? "Client"}</p>
            <p className="text-[11px] text-muted-foreground">
              Sent {fmtDate(send.createdAt)}
              {completed && send.submittedAt
                ? ` · Answered ${fmtDate(send.submittedAt)}`
                : ""}
            </p>
          </div>
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

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={copy}>
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy link"}
          </Button>
          {!completed ? (
            <Button
              asChild
              size="sm"
              className="bg-[#25D366] text-white hover:bg-[#1ebe5d]"
            >
              <a
                href={buildWhatsappHref(
                  shareUrl,
                  client?.name ?? "there",
                  client?.phone,
                )}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            </Button>
          ) : null}
        </div>

        {completed ? (
          <details className="group">
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
