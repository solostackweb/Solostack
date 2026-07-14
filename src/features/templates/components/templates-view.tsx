"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  BookOpen,
  BookTemplate,
  FileSignature,
  FileText,
  Mail,
  Pause,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
  { value: "contract", label: "Contract" },
  { value: "welcome_doc", label: "Welcome doc" },
  { value: "invoice_note", label: "Invoice note" },
  { value: "email", label: "Email" },
];

const DOCUMENT_TYPES: TemplateType[] = ["proposal", "contract", "welcome_doc"];
const SECTION_TYPES: TemplateType[] = ["contract", "welcome_doc"];

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
  const [sections, setSections] = React.useState([
    { id: "s_1", heading: "Scope", body: "" },
    { id: "s_2", heading: "Terms", body: "" },
  ]);
  const groupedTemplates = React.useMemo(
    () =>
      TYPE_OPTIONS.map((option) => ({
        ...option,
        templates: templates.filter((template) => template.templateType === option.value),
      })),
    [templates],
  );

  React.useEffect(() => {
    if (type === "contract") {
      setSections([
        { id: "s_1", heading: "Scope of work", body: "" },
        { id: "s_2", heading: "Fees and payment", body: "" },
        { id: "s_3", heading: "Electronic execution", body: "" },
      ]);
    } else if (type === "welcome_doc") {
      setSections([
        { id: "s_1", heading: "How we will work", body: "" },
        { id: "s_2", heading: "What I need from you", body: "" },
        { id: "s_3", heading: "Approvals and changes", body: "" },
      ]);
    }
  }, [type]);

  const addSection = () => {
    setSections((current) => [
      ...current,
      { id: `s_${Date.now()}`, heading: "New section", body: "" },
    ]);
  };

  const updateSection = (
    id: string,
    patch: Partial<{ heading: string; body: string }>,
  ) => {
    setSections((current) =>
      current.map((section) => (section.id === id ? { ...section, ...patch } : section)),
    );
  };

  const removeSection = (id: string) => {
    setSections((current) => current.filter((section) => section.id !== id));
  };

  return (
    <div className="space-y-6">
      <header className="border-b pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Document system
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Templates</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Build reusable proposal, contract, and welcome document structures so repeat work starts with your best version.
        </p>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <form action={action} className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Create reusable template</h2>
              <p className="text-xs text-muted-foreground">
                Save a structure once, then start documents from it later.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <input type="hidden" name="templateType" value={type} />
            <div className="grid gap-2 sm:grid-cols-3">
              {TYPE_OPTIONS.filter((option) => DOCUMENT_TYPES.includes(option.value)).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value)}
                  className={cn(
                    "rounded-lg border bg-background px-3 py-2 text-left text-sm font-medium transition hover:border-primary/40",
                    type === option.value && "border-primary/60 bg-primary/10 text-primary",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Title</span>
              <Input
                name="title"
                placeholder={
                  type === "contract"
                    ? "Monthly retainer contract"
                    : type === "welcome_doc"
                      ? "Client onboarding guide"
                      : "Website redesign proposal"
                }
                required
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Category</span>
              <Input name="category" placeholder="retainer, onboarding, design..." defaultValue="general" />
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
            ) : SECTION_TYPES.includes(type) ? (
              <>
                {type === "welcome_doc" ? (
                  <>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Intro</span>
                      <Textarea
                        name="body"
                        rows={4}
                        placeholder="A short welcome message shown before the sections."
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm">
                      <span>
                        <span className="font-medium">Require acknowledgement</span>
                        <span className="block text-xs text-muted-foreground">
                          Useful for handoff packs or process confirmations.
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        name="acknowledgementRequired"
                        value="true"
                        className="h-4 w-4"
                      />
                    </label>
                  </>
                ) : null}
                <div className="rounded-xl border bg-background p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Sections
                      </p>
                      <p className="text-xs text-muted-foreground">
                        These become editable sections inside the document builder.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addSection}>
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {sections.map((section, index) => (
                      <div key={section.id} className="rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <Input
                            name="sectionHeading"
                            value={section.heading}
                            onChange={(event) =>
                              updateSection(section.id, { heading: event.target.value })
                            }
                            placeholder="Section heading"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSection(section.id)}
                            disabled={sections.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Textarea
                          name="sectionBody"
                          className="mt-2"
                          rows={4}
                          value={section.body}
                          onChange={(event) =>
                            updateSection(section.id, { body: event.target.value })
                          }
                          placeholder={
                            type === "contract"
                              ? "Use clear clauses and placeholders like [client/business name]."
                              : "Write friendly onboarding instructions, links, or checklists."
                          }
                        />
                      </div>
                    ))}
                  </div>
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
            Saved templates appear in the matching proposal, contract, and welcome document flows.
          </p>
          <div className="mt-4 space-y-5">
            {templates.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No saved templates yet.
              </div>
            ) : (
              groupedTemplates
                .filter((group) => group.templates.length > 0)
                .map((group) => (
                  <div key={group.value}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="space-y-3">
                      {group.templates.map((template) => (
                        <TemplateLibraryCard key={template.id} template={template} />
                      ))}
                    </div>
                  </div>
                ))
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

function TemplateLibraryCard({ template }: { template: TemplateRecord }) {
  const Icon =
    template.templateType === "email"
      ? Mail
      : template.templateType === "invoice_note"
        ? FileText
        : template.templateType === "contract"
          ? FileSignature
          : template.templateType === "welcome_doc"
            ? BookOpen
            : BookTemplate;

  return (
    <article className="rounded-xl border bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
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
