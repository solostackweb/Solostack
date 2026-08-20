"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  BookTemplate,
  Copy,
  FileSignature,
  FileText,
  Mail,
  Pause,
  Pencil,
  Play,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cloneTemplateRedirectAction,
  deleteTemplateAction,
  setTemplateActiveAction,
} from "../actions";
import type { TemplateRecord, TemplateType } from "../builtin";
import { templateTypeLabel } from "../labels";

const TYPE_OPTIONS: Array<{ value: TemplateType; label: string }> = [
  { value: "proposal", label: "Proposal" },
  { value: "contract", label: "Contract" },
  { value: "welcome_doc", label: "Welcome doc" },
];

export function TemplatesView({
  templates,
  builtins = [],
}: {
  templates: TemplateRecord[];
  builtins?: TemplateRecord[];
}) {
  const [starterType, setStarterType] = React.useState<TemplateType>("proposal");
  const groupedTemplates = React.useMemo(
    () =>
      TYPE_OPTIONS.map((option) => ({
        ...option,
        templates: templates.filter(
          (template) => template.templateType === option.value,
        ),
      })),
    [templates],
  );
  const groupedBuiltins = React.useMemo(
    () =>
      TYPE_OPTIONS.map((option) => ({
        ...option,
        templates: builtins.filter(
          (template) => template.templateType === option.value,
        ),
      })),
    [builtins],
  );
  const visibleBuiltins =
    groupedBuiltins.find((group) => group.value === starterType)?.templates ?? [];

  return (
    <div className="space-y-6">
      <header className="border-b pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Document system
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Templates</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Build reusable proposal, contract, and welcome document structures so
          repeat work starts with your best version.
        </p>
      </header>

      {/* Create — compact full-width band; pick a type to open the builder */}
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Create a template</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick a type to open the builder with a live preview and merge fields.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-[420px]">
            {TYPE_OPTIONS.map((option) => (
              <Link
                key={option.value}
                href={`/dashboard/templates/new?type=${option.value}`}
                className="flex items-center gap-2.5 rounded-lg border bg-background p-3 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <TemplateTypeIcon type={option.value} />
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Library — full width, cards flow into a responsive grid as it grows */}
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Your template library</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Saved templates appear in the matching proposal, contract, and welcome
          document flows.
        </p>
        <div className="mt-4 space-y-6">
          {templates.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookTemplate className="h-4 w-4" />
              </span>
              <span>
                No saved templates yet. Create one above or adapt a proven starter below.
              </span>
            </div>
          ) : (
            groupedTemplates
              .filter((group) => group.templates.length > 0)
              .map((group) => (
                <div key={group.value}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {group.templates.map((template) => (
                      <TemplateLibraryCard key={template.id} template={template} />
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      </section>

      {builtins.length > 0 ? (
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Proven starting points
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Starter library</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose the document you are building, then preview or adapt a structure.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" aria-label="Starter template type">
              {groupedBuiltins.map((group) => (
                <button
                  key={group.value}
                  type="button"
                  onClick={() => setStarterType(group.value)}
                  aria-pressed={starterType === group.value}
                  className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors ${
                    starterType === group.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="hidden sm:inline">{group.label}</span>
                  <span className="sm:hidden">{group.label.replace("Welcome doc", "Welcome")}</span>
                  <span className="font-mono text-micro text-muted-foreground">
                    {group.templates.length}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {visibleBuiltins.map((template) => (
              <BuiltinTemplateCard key={template.id} template={template} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function BuiltinTemplateCard({ template }: { template: TemplateRecord }) {
  return (
    <article className="min-w-0 rounded-lg border bg-background p-4">
      <div className="flex items-center gap-2">
        <TemplateTypeIcon type={template.templateType} />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {template.title}
        </h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-micro font-semibold text-muted-foreground">
          {templateTypeLabel(template.templateType)}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {template.description ?? template.category}
      </p>
      <div className="mt-3 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-start sm:justify-between">
        <TemplatePreview template={template} compact />
        <form action={cloneTemplateRedirectAction} className="shrink-0">
          <input type="hidden" name="sourceId" value={template.id} />
          <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
            <Wand2 className="h-3.5 w-3.5" /> Use as starting point
          </Button>
        </form>
      </div>
    </article>
  );
}

function TemplateLibraryCard({ template }: { template: TemplateRecord }) {
  return (
    <article className="flex h-full flex-col rounded-lg border bg-background p-4">
      <div className="flex items-center gap-2">
        <TemplateTypeIcon type={template.templateType} />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {template.title}
        </h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-micro font-semibold text-muted-foreground">
          {templateTypeLabel(template.templateType)}
        </span>
        {!template.active ? (
          <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-micro font-semibold text-warning-strong">
            Paused
          </span>
        ) : null}
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {template.description ?? template.category}
      </p>
      <TemplatePreview template={template} />
      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        <Button asChild size="sm" variant="outline">
          <Link href={`/dashboard/templates/${template.id}`}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
        </Button>
        <form action={cloneTemplateRedirectAction}>
          <input type="hidden" name="sourceId" value={template.id} />
          <Button size="sm" variant="outline">
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </Button>
        </form>
        <form action={setTemplateActiveAction}>
          <input type="hidden" name="id" value={template.id} />
          <input type="hidden" name="active" value={String(!template.active)} />
          <Button size="sm" variant="outline">
            {template.active ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {template.active ? "Pause" : "Activate"}
          </Button>
        </form>
        <form action={deleteTemplateAction}>
          <input type="hidden" name="id" value={template.id} />
          <Button size="sm" variant="outline">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </form>
      </div>
    </article>
  );
}

function TemplateTypeIcon({ type }: { type: TemplateType }) {
  const Icon =
    type === "email"
      ? Mail
      : type === "invoice_note"
        ? FileText
        : type === "contract"
          ? FileSignature
          : type === "welcome_doc"
            ? BookOpen
            : BookTemplate;
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      <Icon className="h-4 w-4" />
    </span>
  );
}

function TemplatePreview({
  template,
  compact = false,
}: {
  template: TemplateRecord;
  compact?: boolean;
}) {
  const c = (template.content ?? {}) as Record<string, unknown>;
  const type = template.templateType;
  const blocks: Array<{ heading: string; body: string }> = [];
  const pushStr = (heading: string, v: unknown) => {
    if (typeof v === "string" && v.trim()) blocks.push({ heading, body: v });
  };
  if (type === "proposal") {
    pushStr("Scope", c.scope);
    pushStr("Deliverables", c.deliverables);
    pushStr("Timeline", c.timeline);
    pushStr("Terms", c.terms);
  } else if (type === "contract" || type === "welcome_doc") {
    if (type === "welcome_doc") pushStr("Intro", c.intro);
    const secs =
      (c.sections as Array<{ heading: string; body: string }> | undefined) ?? [];
    for (const s of secs) blocks.push({ heading: s.heading, body: s.body });
  } else {
    pushStr("Subject", c.subject);
    pushStr("Body", c.body);
  }
  if (blocks.length === 0) return null;
  return (
    <details className={`group min-w-0 ${compact ? "" : "mt-2"}`}>
      <summary className="cursor-pointer list-none text-xs font-medium text-primary hover:underline">
        Preview
      </summary>
      <div className="mt-2 space-y-2 border-t pt-2">
        {blocks.map((b, i) => (
          <div key={i}>
            <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
              {b.heading}
            </p>
            <p className="mt-0.5 line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-foreground/80">
              {b.body}
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}
