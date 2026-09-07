"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, ExternalLink, FileSpreadsheet, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IvoEntryPoint } from "@/features/ai-workflows/components/ivo-entry-point";
import { connectQuestionnaireSheetAction, retryQuestionnaireSheetSyncAction } from "../actions";
import { followUpAnswerKey, OTHER_OPTION_VALUE, otherAnswerKey, type QuestionnaireResponse, type QuestionnaireSend, type QuestionnaireSheetIntegration } from "../types";
import { SendQuestionnaireDialog, buildWhatsappHref, type SendClientOption } from "./send-questionnaire-dialog";

function fmtDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export function QuestionnaireResponsesView({ questionnaireId, questionnaireTitle, clients, sends, responses, sheetIntegration }: {
  questionnaireId: string;
  questionnaireTitle: string;
  clients: SendClientOption[];
  sends: QuestionnaireSend[];
  responses: QuestionnaireResponse[];
  sheetIntegration: QuestionnaireSheetIntegration | null;
}) {
  const clientFor = (id: string | null) => clients.find((client) => client.id === id);
  return <div className="space-y-6">
    <PageHeader title="Responses" description={questionnaireTitle} actions={<div className="flex items-center gap-2"><Button asChild variant="outline" size="sm"><Link href="/dashboard/questionnaires"><ArrowLeft className="h-4 w-4" /> Questionnaires</Link></Button><SendQuestionnaireDialog questionnaireId={questionnaireId} clients={clients} /></div>} />
    <div className="grid gap-3 sm:grid-cols-2"><Stat label="Active links" value={sends.length} /><Stat label="Responses" value={responses.length} /></div>
    <SheetsPanel questionnaireId={questionnaireId} integration={sheetIntegration} />

    <section className="space-y-3">
      <div><h2 className="text-base font-semibold">Collection links</h2><p className="mt-1 text-sm text-muted-foreground">Each link can collect any number of responses.</p></div>
      {sends.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No collection link yet. Send this questionnaire to create one.</CardContent></Card> : sends.map((send) => <CollectorCard key={send.id} send={send} client={clientFor(send.clientId)} responseCount={responses.filter((response) => response.sendId === send.id).length} />)}
    </section>

    <section className="space-y-3">
      <div><h2 className="text-base font-semibold">Submitted responses</h2><p className="mt-1 text-sm text-muted-foreground">Newest first. Every entry is preserved separately.</p></div>
      {responses.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Responses will appear here as people submit the form.</CardContent></Card> : responses.map((response, index) => <ResponseCard key={response.id} response={response} client={clientFor(response.clientId)} number={responses.length - index} />)}
    </section>
  </div>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-bold tabular-nums">{value}</p></CardContent></Card>;
}

function SheetsPanel({ questionnaireId, integration }: { questionnaireId: string; integration: QuestionnaireSheetIntegration | null }) {
  const [working, setWorking] = React.useState(false);
  const connect = async () => {
    setWorking(true);
    const result = await connectQuestionnaireSheetAction(questionnaireId);
    setWorking(false);
    if (!result.ok) return void toast.error(result.error);
    if (result.data?.reconnectUrl) {
      window.location.href = result.data.reconnectUrl;
      return;
    }
    toast.success(result.message ?? "Google Sheet connected.");
    if (result.data?.spreadsheetUrl) window.open(result.data.spreadsheetUrl, "_blank", "noopener,noreferrer");
  };
  return <Card><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><FileSpreadsheet className="h-5 w-5" /></span><div><p className="text-sm font-semibold">Google Sheets</p><p className="mt-1 max-w-xl text-sm text-muted-foreground">{integration ? "New responses are appended automatically. Stackivo remains the source of truth." : "Create a private response sheet in your Google account and sync existing and future responses."}</p>{integration?.lastError ? <p className="mt-1 text-xs text-destructive">Last sync needs attention: {integration.lastError}</p> : null}</div></div>
    {integration ? <Button asChild variant="outline" size="sm"><a href={integration.spreadsheetUrl} target="_blank" rel="noreferrer">Open sheet <ExternalLink className="h-4 w-4" /></a></Button> : <Button type="button" size="sm" onClick={connect} disabled={working}>{working ? "Connecting…" : "Connect Google Sheets"}</Button>}
  </CardContent></Card>;
}

function CollectorCard({ send, client, responseCount }: { send: QuestionnaireSend; client?: SendClientOption; responseCount: number }) {
  const [copied, setCopied] = React.useState(false);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/q/${send.publicToken}` : `/q/${send.publicToken}`;
  const copy = async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return <Card><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{client?.name ?? "Public collection link"}</p><p className="mt-1 text-xs text-muted-foreground">Created {fmtDate(send.createdAt)} · {responseCount} {responseCount === 1 ? "response" : "responses"}</p></div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={copy}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy link"}</Button><Button asChild size="sm" className="bg-[#25D366] text-white hover:bg-[#1ebe5d]"><a href={buildWhatsappHref(shareUrl, client?.name ?? "there", client?.phone)} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a></Button></div></CardContent></Card>;
}

function displayAnswer(response: QuestionnaireResponse, questionId: string): string {
  const raw = response.responses[questionId];
  const primary = Array.isArray(raw) ? raw.map((value) => value === OTHER_OPTION_VALUE ? "Other" : String(value)).join(", ") : raw === OTHER_OPTION_VALUE ? "Other" : raw === undefined || raw === "" ? "—" : String(raw);
  const other = response.responses[otherAnswerKey(questionId)];
  return other ? `${primary}: ${String(other)}` : primary;
}

function ResponseCard({ response, client, number }: { response: QuestionnaireResponse; client?: SendClientOption; number: number }) {
  const [syncing, setSyncing] = React.useState(false);
  const retry = async () => {
    setSyncing(true);
    const result = await retryQuestionnaireSheetSyncAction(response.id);
    setSyncing(false);
    if (result.ok) toast.success(result.message);
    else toast.error(result.error);
  };
  const respondentName = String(response.responses.__respondent_name ?? client?.name ?? `Response ${number}`);
  const respondentEmail = typeof response.responses.__respondent_email === "string" ? response.responses.__respondent_email : null;
  return <Card><CardContent className="space-y-3 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">{respondentName}</p><p className="mt-1 text-xs text-muted-foreground">{respondentEmail ? `${respondentEmail} · ` : ""}Submitted {fmtDate(response.submittedAt)}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-success-subtle px-2 py-0.5 text-micro font-semibold text-success-strong">Received</span>{response.sheetsSyncStatus === "failed" ? <Button type="button" variant="outline" size="sm" onClick={retry} disabled={syncing}><RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Retry Sheet</Button> : null}</div></div>
    <div className="flex flex-wrap gap-2"><IvoEntryPoint label="Analyze with IVo" prompt="Analyze this questionnaire response. Summarize the respondent's goals, constraints, unanswered questions, risks, and the best next actions. Stay grounded in the attached response." resources={[{ type: "questionnaire_response", id: response.id, label: "Questionnaire response", subtitle: respondentName }]} /></div>
    <details className="group"><summary className="cursor-pointer text-xs font-medium text-primary hover:underline">View answers</summary><div className="mt-3 space-y-4 border-t pt-4">{response.questions.map((question) => <div key={question.id}><p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">{question.label}</p><p className="mt-1 whitespace-pre-line text-sm text-foreground/90">{displayAnswer(response, question.id)}</p>{question.conditionalFollowUp && response.responses[followUpAnswerKey(question.id)] ? <div className="mt-2 border-l-2 border-primary/30 pl-3"><p className="text-xs font-medium text-muted-foreground">{question.conditionalFollowUp.label}</p><p className="mt-1 whitespace-pre-line text-sm">{String(response.responses[followUpAnswerKey(question.id)])}</p></div> : null}</div>)}</div></details>
  </CardContent></Card>;
}
