"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, ExternalLink, FileSpreadsheet, MessageCircle, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IvoEntryPoint } from "@/features/ai-workflows/components/ivo-entry-point";
import { connectQuestionnaireSheetAction, deleteQuestionnaireResponseAction, repairQuestionnaireSheetAction, retryQuestionnaireSheetSyncAction, revokeQuestionnaireLinkAction } from "../actions";
import { followUpAnswerKey, OTHER_OPTION_VALUE, otherAnswerKey, type QuestionnaireResponse, type QuestionnaireSend, type QuestionnaireSheetIntegration } from "../types";
import { SendQuestionnaireDialog, buildWhatsappHref, type SendClientOption } from "./send-questionnaire-dialog";

function fmtDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export function QuestionnaireResponsesView({ questionnaireId, questionnaireTitle, clients, sends, responses, responseTotal, responsePage, responsePageSize, responseSearch, sheetIntegration }: {
  questionnaireId: string;
  questionnaireTitle: string;
  clients: SendClientOption[];
  sends: QuestionnaireSend[];
  responses: QuestionnaireResponse[];
  responseTotal: number;
  responsePage: number;
  responsePageSize: number;
  responseSearch: string;
  sheetIntegration: QuestionnaireSheetIntegration | null;
}) {
  const clientFor = (id: string | null) => clients.find((client) => client.id === id);
  return <div className="space-y-6">
    <PageHeader title="Responses" description={questionnaireTitle} actions={<div className="flex items-center gap-2"><Button asChild variant="outline" size="sm"><Link href="/dashboard/questionnaires"><ArrowLeft className="h-4 w-4" /> Questionnaires</Link></Button><SendQuestionnaireDialog questionnaireId={questionnaireId} clients={clients} /></div>} />
    <div className="grid gap-3 sm:grid-cols-2"><Stat label="Active links" value={sends.length} /><Stat label="Responses" value={responseTotal} /></div>
    <SheetsPanel questionnaireId={questionnaireId} integration={sheetIntegration} />

    <section className="space-y-3">
      <div><h2 className="text-base font-semibold">Collection links</h2><p className="mt-1 text-sm text-muted-foreground">Each link can collect any number of responses.</p></div>
      {sends.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No collection link yet. Send this questionnaire to create one.</CardContent></Card> : sends.map((send) => <CollectorCard key={send.id} send={send} client={clientFor(send.clientId)} />)}
    </section>

    <ResponseDirectory questionnaireId={questionnaireId} responses={responses} clients={clients} total={responseTotal} page={responsePage} pageSize={responsePageSize} search={responseSearch} />
  </div>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-bold tabular-nums">{value}</p></CardContent></Card>;
}

function SheetsPanel({ questionnaireId, integration }: { questionnaireId: string; integration: QuestionnaireSheetIntegration | null }) {
  const router = useRouter();
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
  const repair = async () => {
    setWorking(true);
    const result = await repairQuestionnaireSheetAction(questionnaireId);
    setWorking(false);
    if (!result.ok) return void toast.error(result.error);
    toast.success(result.message);
    router.refresh();
  };
  return <Card><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><FileSpreadsheet className="h-5 w-5" /></span><div><p className="text-sm font-semibold">Google Sheets</p><p className="mt-1 max-w-xl text-sm text-muted-foreground">{integration ? "New responses are appended automatically. Stackivo remains the source of truth." : "Create a private response sheet in your Google account and sync existing and future responses."}</p>{integration?.lastError ? <p className="mt-1 text-xs text-destructive">Last sync needs attention: {integration.lastError}</p> : null}</div></div>
    {integration ? <div className="flex flex-wrap gap-2"><Button type="button" variant={integration.lastError ? "default" : "outline"} size="sm" onClick={repair} disabled={working}><RefreshCw className={`h-4 w-4 ${working ? "animate-spin" : ""}`} /> {working ? "Repairing…" : "Repair sync"}</Button><Button asChild variant="outline" size="sm"><a href={integration.spreadsheetUrl} target="_blank" rel="noreferrer">Open sheet <ExternalLink className="h-4 w-4" /></a></Button></div> : <Button type="button" size="sm" onClick={connect} disabled={working}>{working ? "Connecting…" : "Connect Google Sheets"}</Button>}
  </CardContent></Card>;
}

function CollectorCard({ send, client }: { send: QuestionnaireSend; client?: SendClientOption }) {
  const [copied, setCopied] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/q/${send.publicToken}` : `/q/${send.publicToken}`;
  const copy = async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const revoke = async () => {
    if (!window.confirm("Delete this public link? Existing responses will be kept.")) return;
    setDeleting(true);
    const result = await revokeQuestionnaireLinkAction(send.id);
    setDeleting(false);
    if (result.ok) { toast.success(result.message); window.location.reload(); }
    else toast.error(result.error);
  };
  return <Card><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{client?.name ?? "Public collection link"}</p><p className="mt-1 text-xs text-muted-foreground">Created {fmtDate(send.createdAt)} · Reusable collection link</p></div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={copy}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy link"}</Button><Button asChild size="sm" className="bg-[#25D366] text-white hover:bg-[#1ebe5d]"><a href={buildWhatsappHref(shareUrl, client?.name ?? "there", client?.phone)} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a></Button><Button type="button" size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={revoke} disabled={deleting}><Trash2 className="h-3.5 w-3.5" /> {deleting ? "Deleting…" : "Delete link"}</Button></div></CardContent></Card>;
}

function displayAnswer(response: QuestionnaireResponse, questionId: string): string {
  const raw = response.responses[questionId];
  const primary = Array.isArray(raw) ? raw.map((value) => value === OTHER_OPTION_VALUE ? "Other" : String(value)).join(", ") : raw === OTHER_OPTION_VALUE ? "Other" : raw === undefined || raw === "" ? "—" : String(raw);
  const other = response.responses[otherAnswerKey(questionId)];
  return other ? `${primary}: ${String(other)}` : primary;
}

function ResponseDirectory({ questionnaireId, responses, clients, total, page, pageSize, search }: {
  questionnaireId: string;
  responses: QuestionnaireResponse[];
  clients: SendClientOption[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const hrefFor = (targetPage: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return `/dashboard/questionnaires/${questionnaireId}/responses${query ? `?${query}` : ""}`;
  };

  return <section className="space-y-3" data-density="compact">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 className="text-base font-semibold">Submitted responses</h2><p className="mt-1 text-sm text-muted-foreground">Search and inspect responses without loading the complete collection.</p></div>
      <form method="get" action={`/dashboard/questionnaires/${questionnaireId}/responses`} className="flex w-full gap-2 sm:max-w-sm">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search responses by name or email</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={search} placeholder="Search name or email" className="h-11 pl-9" />
        </label>
        <Button type="submit" variant="outline" className="min-h-11">Search</Button>
        {search ? <Button asChild type="button" variant="ghost" className="min-h-11 px-3"><Link href={`/dashboard/questionnaires/${questionnaireId}/responses`}>Clear</Link></Button> : null}
      </form>
    </div>

    <Card className="overflow-hidden">
      {responses.length === 0 ? <CardContent className="p-10 text-center"><p className="text-sm font-medium">{search ? "No matching responses" : "No responses yet"}</p><p className="mt-1 text-sm text-muted-foreground">{search ? "Try another name or email address." : "Responses will appear here after someone submits the form."}</p></CardContent> : <>
        <p className="border-b px-4 py-2 text-xs text-muted-foreground sm:hidden">Swipe sideways to see response actions.</p>
        <Table className="min-w-[760px]">
          <TableHeader className="bg-muted/30"><TableRow><TableHead className="w-[38%]">Respondent</TableHead><TableHead>Submitted</TableHead><TableHead>Sheet status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{responses.map((response, index) => <ResponseRow key={response.id} response={response} client={clients.find((client) => client.id === response.clientId)} number={total - ((page - 1) * pageSize + index)} expanded={expandedId === response.id} onToggle={() => setExpandedId((current) => current === response.id ? null : response.id)} />)}</TableBody>
        </Table>
      </>}
      <div className="flex min-h-14 flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs tabular-nums text-muted-foreground">Showing {start}–{end} of {total.toLocaleString()} responses</p>
        <div className="flex items-center gap-2">
          <Button asChild={page > 1} variant="outline" size="sm" disabled={page <= 1} className="min-h-10">{page > 1 ? <Link href={hrefFor(page - 1)}><ChevronLeft className="h-4 w-4" /> Previous</Link> : <span><ChevronLeft className="h-4 w-4" /> Previous</span>}</Button>
          <span className="min-w-20 text-center text-xs font-medium tabular-nums">Page {Math.min(page, totalPages)} of {totalPages}</span>
          <Button asChild={page < totalPages} variant="outline" size="sm" disabled={page >= totalPages} className="min-h-10">{page < totalPages ? <Link href={hrefFor(page + 1)}>Next <ChevronRight className="h-4 w-4" /></Link> : <span>Next <ChevronRight className="h-4 w-4" /></span>}</Button>
        </div>
      </div>
    </Card>
  </section>;
}

function ResponseRow({ response, client, number, expanded, onToggle }: { response: QuestionnaireResponse; client?: SendClientOption; number: number; expanded: boolean; onToggle: () => void }) {
  const router = useRouter();
  const [syncing, setSyncing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const retry = async () => {
    setSyncing(true);
    const result = await retryQuestionnaireSheetSyncAction(response.id);
    setSyncing(false);
    if (result.ok) toast.success(result.message);
    else toast.error(result.error);
  };
  const remove = async () => {
    if (!window.confirm("Delete this response? It will also be removed from the connected Google Sheet. This cannot be undone.")) return;
    setDeleting(true);
    const result = await deleteQuestionnaireResponseAction(response.id);
    setDeleting(false);
    if (!result.ok) return void toast.error(result.error);
    toast.success(result.message);
    router.refresh();
  };
  const respondentName = String(response.responses.__respondent_name ?? client?.name ?? `Response ${number}`);
  const respondentEmail = typeof response.responses.__respondent_email === "string" ? response.responses.__respondent_email : null;
  const status = response.sheetsSyncStatus === "failed" ? "Needs attention" : response.sheetsSyncStatus === "synced" ? "Synced" : "Stored in Stackivo";
  return <React.Fragment>
    <TableRow className={expanded ? "bg-muted/30" : undefined}>
      <TableCell className="py-3"><p className="truncate font-semibold">{respondentName}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{respondentEmail ?? "No email recorded"}</p></TableCell>
      <TableCell className="whitespace-nowrap py-3 text-xs text-muted-foreground">{fmtDate(response.submittedAt)}</TableCell>
      <TableCell className="py-3"><span className={response.sheetsSyncStatus === "failed" ? "text-xs font-medium text-destructive" : "text-xs font-medium text-muted-foreground"}>{status}</span></TableCell>
      <TableCell className="py-3"><div className="flex items-center justify-end gap-1"><Button type="button" variant="ghost" size="sm" onClick={onToggle} aria-expanded={expanded}>{expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} Answers</Button><IvoEntryPoint label="Analyze" prompt="Analyze this questionnaire response. Summarize the respondent's goals, constraints, unanswered questions, risks, and the best next actions. Stay grounded in the attached response." resources={[{ type: "questionnaire_response", id: response.id, label: "Questionnaire response", subtitle: respondentName }]} />{response.sheetsSyncStatus === "failed" ? <Button type="button" variant="ghost" size="sm" onClick={retry} disabled={syncing}><RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Retry</Button> : null}<Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-destructive" onClick={remove} disabled={deleting} aria-label={`Delete response from ${respondentName}`}><Trash2 className="h-4 w-4" /></Button></div></TableCell>
    </TableRow>
    {expanded ? <TableRow className="hover:bg-transparent"><TableCell colSpan={4} className="bg-muted/10 p-5"><div className="grid gap-x-8 gap-y-5 md:grid-cols-2">{response.questions.filter((question) => !question.id.startsWith("__respondent_")).map((question) => <div key={question.id} className="min-w-0"><p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">{question.label}</p><p className="mt-1 whitespace-pre-line break-words text-sm text-foreground/90">{displayAnswer(response, question.id)}</p>{question.conditionalFollowUp && response.responses[followUpAnswerKey(question.id)] ? <div className="mt-2 border-l-2 border-primary/30 pl-3"><p className="text-xs font-medium text-muted-foreground">{question.conditionalFollowUp.label}</p><p className="mt-1 whitespace-pre-line break-words text-sm">{String(response.responses[followUpAnswerKey(question.id)])}</p></div> : null}</div>)}</div></TableCell></TableRow> : null}
  </React.Fragment>;
}
