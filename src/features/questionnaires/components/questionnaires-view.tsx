import Link from "next/link";
import { FileQuestion, Pencil, Plus, Send, Trash2, Wand2 } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QUESTIONNAIRE_STARTERS } from "../builtin";
import type { Questionnaire } from "../types";
import {
  createFromStarterAction,
  deleteQuestionnaireAction,
} from "../actions";

export function QuestionnairesView({
  questionnaires,
}: {
  questionnaires: Questionnaire[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Questionnaires"
        description="Build reusable intake forms and send them to clients to collect scope, brand, and project details."
        actions={
          <Button asChild size="sm">
            <Link href="/dashboard/questionnaires/new">
              <Plus className="h-4 w-4" /> New questionnaire
            </Link>
          </Button>
        }
      />

      {questionnaires.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Your questionnaires
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {questionnaires.map((q) => (
              <Card key={q.id}>
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
                      <FileQuestion className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold">
                        {q.title}
                      </h3>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {q.description ?? `${q.questions.length} questions`}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {q.questions.length} question
                    {q.questions.length === 1 ? "" : "s"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/questionnaires/${q.id}`}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href={`/dashboard/questionnaires/${q.id}/send`}>
                        <Send className="h-3.5 w-3.5" /> Send
                      </Link>
                    </Button>
                    <form action={deleteQuestionnaireAction}>
                      <input type="hidden" name="id" value={q.id} />
                      <Button size="sm" variant="ghost" className="text-destructive">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileQuestion className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              No questionnaires yet. Start from scratch or fork a starter below.
            </p>
            <Button asChild size="sm">
              <Link href="/dashboard/questionnaires/new">
                <Plus className="h-4 w-4" /> New questionnaire
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Starter templates
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {QUESTIONNAIRE_STARTERS.map((starter) => (
            <Card key={starter.id}>
              <CardContent className="flex h-full flex-col p-5">
                <h3 className="text-sm font-semibold">{starter.title}</h3>
                <p className="mt-1 line-clamp-2 flex-1 text-xs text-muted-foreground">
                  {starter.description}
                </p>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {starter.questions.length} questions
                </p>
                <form action={createFromStarterAction} className="mt-3">
                  <input type="hidden" name="starterId" value={starter.id} />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    <Wand2 className="h-3.5 w-3.5" /> Use as starting point
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
