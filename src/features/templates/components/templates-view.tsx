"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { BookTemplate, FileText, Mail, Pause, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createTemplateAction,
  deleteTemplateAction,
  setTemplateActiveAction,
  type TemplateActionResult,
} from "../actions";
import type { TemplateRecord, TemplateType } from "../builtin";
import { templateTypeLabel } from "../labels";

const TYPE_OPTIONS: Array<{ value: TemplateType; label: string }> = [
  { value: "proposal", label: "Proposal" },
  { value: "invoice_note", label: "Invoice note" },
  { value: "email", label: "Email" },
];

export function TemplatesView({
  templates,
}: {
  templates: TemplateRecord[];
}) {
  const [state, action] = useActionState<TemplateActionResult<{ id: string }> | undefined, FormData>(
    createTemplateAction,
    undefined,
  );
  const [type, setType] = React.useState<TemplateType>("proposal");

  return (
    <div className="space-y-6">
      <header className="border-b pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Reusable assets
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Templates</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Save proposal structures, export invoice notes, and client email copy so repeat work starts faster.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <form action={action} className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Plus className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Create template</h2>
              <p className="text-xs text-muted-foreground">Start with the reusable text you use most often.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Type</span>
              <select
                name="templateType"
                value={type}
                onChange={(event) => setType(event.target.value as TemplateType)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Title</span>
              <Input name="title" placeholder="Monthly retainer proposal" required />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Category</span>
              <Input name="category" placeholder="retainer, export, follow-up..." defaultValue="general" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              <Textarea name="description" rows={2} placeholder="Where this template is useful." />
            </label>

            {type === "proposal" ? (
              <>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Scope</span>
                  <Textarea name="scope" rows={4} />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Deliverables</span>
                  <Textarea name="deliverables" rows={4} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Timeline</span>
                    <Textarea name="timeline" rows={4} />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Terms</span>
                    <Textarea name="terms" rows={4} />
                  </label>
                </div>
              </>
            ) : (
              <>
                {type === "email" ? (
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Subject</span>
                    <Input name="subject" placeholder="Following up on the proposal" />
                  </label>
                ) : null}
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Body</span>
                  <Textarea name="body" rows={7} />
                </label>
              </>
            )}
          </div>

          {state && !state.ok ? (
            <p className="mt-3 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          {state?.ok ? (
            <p className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              {state.message}
            </p>
          ) : null}
          <SubmitButton />
        </form>

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Your template library</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Built-ins are available in document builders; saved templates appear here.
          </p>
          <div className="mt-4 space-y-3">
            {templates.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No saved templates yet.
              </div>
            ) : (
              templates.map((template) => (
                <article key={template.id} className="rounded-xl border bg-background p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          {template.templateType === "email" ? <Mail className="h-4 w-4" /> : template.templateType === "invoice_note" ? <FileText className="h-4 w-4" /> : <BookTemplate className="h-4 w-4" />}
                        </span>
                        <h3 className="truncate text-sm font-semibold">{template.title}</h3>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {templateTypeLabel(template.templateType)}
                        </span>
                        {!template.active ? (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                            Paused
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {template.description ?? template.category}
                      </p>
                    </div>
                    {!template.isSystem ? (
                      <div className="flex shrink-0 gap-2">
                        <form action={setTemplateActiveAction}>
                          <input type="hidden" name="id" value={template.id} />
                          <input type="hidden" name="active" value={String(!template.active)} />
                          <Button size="sm" variant="outline">
                            {template.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            {template.active ? "Pause" : "Activate"}
                          </Button>
                        </form>
                        <form action={deleteTemplateAction}>
                          <input type="hidden" name="id" value={template.id} />
                          <Button size="sm" variant="outline">
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="mt-4 w-full" disabled={pending}>
      {pending ? "Saving..." : "Save template"}
    </Button>
  );
}
