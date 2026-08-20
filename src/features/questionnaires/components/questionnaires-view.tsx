import Link from "next/link";
import {
  CheckCircle2,
  FileQuestion,
  Inbox,
  Plus,
  Send,
  Trash2,
  Wand2,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IvoEntryPoint } from "@/features/ai-workflows/components/ivo-entry-point";
import { QUESTIONNAIRE_STARTERS } from "../builtin";
import type { Questionnaire } from "../types";
import {
  createFromStarterAction,
  deleteQuestionnaireAction,
} from "../actions";
import {
  SendQuestionnaireDialog,
  type SendClientOption,
} from "./send-questionnaire-dialog";

const questionnaireFlow = [
  { label: "Build brief", icon: FileQuestion },
  { label: "Client response", icon: Send },
  { label: "Ready to start", icon: CheckCircle2 },
];

function QuestionnaireStartDesk() {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="grid lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <div className="border-b border-border/60 bg-primary/[0.025] p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
          <p className="text-micro font-semibold uppercase tracking-[0.16em] text-primary">
            Brief desk
          </p>
          <h2 className="mt-3 max-w-md font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Collect the context before work begins.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Start with a focused brief, tailor the questions, then send one
            clear request to your client.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild className="min-h-11">
              <Link href="/dashboard/questionnaires/new">
                <Plus className="h-4 w-4" /> Start blank
              </Link>
            </Button>
            <IvoEntryPoint
              prompt="Help me prepare the right questions for my first client brief."
              label="Ask Ivo"
              variant="ghost"
              className="min-h-11"
            />
          </div>
        </div>

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-lg rounded-lg border border-border/70 bg-background p-5 sm:p-6">
            <div className="border-b border-border/60 pb-5">
              <p className="text-micro font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Before kickoff
              </p>
              <p className="mt-2 text-base font-semibold">
                One brief, fewer missing details
              </p>
            </div>

            <div className="relative mt-6 grid grid-cols-3">
              <div
                aria-hidden
                className="absolute left-[16.66%] right-[16.66%] top-4 h-px bg-primary/25"
              />
              {questionnaireFlow.map(({ label, icon: Icon }, index) => (
                <div
                  key={label}
                  className="relative z-10 flex flex-col items-center text-center"
                >
                  <span
                    className={
                      index === 0
                        ? "flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
                        : "flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-background text-primary"
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="mt-2 text-xs font-semibold">{label}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 divide-y divide-border/60 border-t border-border/60">
              {["Scope and goals", "Inputs and constraints", "Kickoff readiness"].map(
                (label, index) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 py-3 text-sm"
                  >
                    <span className="font-mono text-micro text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StarterLibrary() {
  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <div className="border-b border-border/60 px-5 py-4 sm:px-6">
        <p className="text-micro font-semibold uppercase tracking-[0.14em] text-primary">
          Starting briefs
        </p>
        <h2 className="mt-1 text-base font-semibold">
          Choose the closest client conversation
        </h2>
      </div>
      <div className="divide-y divide-border/60">
        {QUESTIONNAIRE_STARTERS.map((starter) => (
          <div
            key={starter.id}
            className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-sm font-semibold">{starter.title}</h3>
                <span className="font-mono text-micro text-muted-foreground">
                  {starter.questions.length} questions
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
                {starter.description}
              </p>
            </div>
            <form action={createFromStarterAction}>
              <input type="hidden" name="starterId" value={starter.id} />
              <Button
                type="submit"
                variant="outline"
                className="min-h-11 w-full sm:w-auto"
              >
                <Wand2 className="h-3.5 w-3.5" /> Use brief
              </Button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}

export function QuestionnairesView({
  questionnaires,
  clients,
}: {
  questionnaires: Questionnaire[];
  clients: SendClientOption[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Questionnaires"
        description="Build reusable intake forms and send them to clients to collect scope, brand, and project details."
        actions={
          questionnaires.length > 0 ? (
            <div className="flex items-center gap-2">
              <IvoEntryPoint
                prompt="What should I ask a new client before starting a project?"
                variant="secondary"
              />
              <Button asChild size="sm">
                <Link href="/dashboard/questionnaires/new">
                  <Plus className="h-4 w-4" /> New questionnaire
                </Link>
              </Button>
            </div>
          ) : null
        }
      />

      {questionnaires.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Your questionnaires
          </h2>
          <Card>
            <CardContent className="divide-y p-0">
            {questionnaires.map((q) => (
              <div key={q.id} className="flex min-w-0 items-start gap-3 p-4 sm:items-center sm:px-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
                      <FileQuestion className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/questionnaires/${q.id}`}
                        className="block truncate text-sm font-semibold hover:text-primary"
                      >
                        {q.title}
                      </Link>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {q.description ?? `${q.questions.length} questions`}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {q.questions.length} question{q.questions.length === 1 ? "" : "s"}
                        </span>
                        <Link
                          href={`/dashboard/questionnaires/${q.id}/responses`}
                          className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
                        >
                          <Inbox className="h-3.5 w-3.5" /> Responses
                        </Link>
                      </div>
                    </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                    <SendQuestionnaireDialog
                      questionnaireId={q.id}
                      clients={clients}
                      trigger={
                        <Button size="sm">
                          <Send className="h-3.5 w-3.5" /> Send
                        </Button>
                      }
                    />
                    <form action={deleteQuestionnaireAction}>
                      <input type="hidden" name="id" value={q.id} />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${q.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  </div>
              </div>
            ))}
            </CardContent>
          </Card>
        </section>
      ) : (
        <QuestionnaireStartDesk />
      )}

      <StarterLibrary />
    </div>
  );
}
