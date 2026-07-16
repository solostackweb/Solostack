"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  PencilLine,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  createTemplateAction,
  updateTemplateAction,
  type TemplateActionResult,
} from "../actions";
import type {
  ContractTemplateContent,
  ProposalTemplateContent,
  TemplateRecord,
  TemplateType,
  WelcomeDocTemplateContent,
} from "../builtin";
import { templateTypeLabel } from "../labels";
import { MERGE_VARIABLES } from "../merge-fields";

interface Section {
  id: string;
  heading: string;
  body: string;
}

const SAMPLE_VALUES: Record<string, string> = Object.fromEntries(
  MERGE_VARIABLES.map((v) => [v.key, v.sample]),
);

/** Human labels for the fields the server can flag, used in the error banner. */
const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  category: "Category",
  description: "Description",
  scope: "Scope",
  deliverables: "Deliverables",
  timeline: "Timeline",
  terms: "Terms",
  subject: "Subject",
  body: "Body",
};

/** Order in which to jump to the first field needing a fix. */
const FIELD_ORDER = [
  "title",
  "category",
  "description",
  "scope",
  "deliverables",
  "timeline",
  "terms",
  "subject",
  "body",
];

export function TemplateEditor({
  mode,
  templateType,
  template,
}: {
  mode: "create" | "edit";
  templateType: TemplateType;
  template?: TemplateRecord;
}) {
  const router = useRouter();
  const type = templateType;
  const content = (template?.content ?? {}) as Record<string, unknown>;

  const [title, setTitle] = React.useState(template?.title ?? "");
  const [category, setCategory] = React.useState(template?.category ?? "general");
  const [description, setDescription] = React.useState(template?.description ?? "");

  const p = content as ProposalTemplateContent;
  const [scope, setScope] = React.useState(p.scope ?? "");
  const [deliverables, setDeliverables] = React.useState(p.deliverables ?? "");
  const [timeline, setTimeline] = React.useState(p.timeline ?? "");
  const [terms, setTerms] = React.useState(p.terms ?? "");

  const [subject, setSubject] = React.useState(
    typeof content.subject === "string" ? content.subject : "",
  );
  const [body, setBody] = React.useState(
    type === "welcome_doc"
      ? ((content as WelcomeDocTemplateContent).intro ?? "")
      : typeof content.body === "string"
        ? content.body
        : "",
  );

  const usesSections = type === "contract" || type === "welcome_doc";
  const initialSections = (
    (content as ContractTemplateContent | WelcomeDocTemplateContent).sections ??
    []
  ).map((s, i) => ({ id: `s_${i}`, heading: s.heading, body: s.body }));
  const [sections, setSections] = React.useState<Section[]>(
    initialSections.length > 0
      ? initialSections
      : usesSections
        ? [{ id: "s_0", heading: "Section", body: "" }]
        : [],
  );

  // ---- Merge-field insertion into the last-focused field -------------------
  const activeFieldRef = React.useRef<{
    el: HTMLInputElement | HTMLTextAreaElement;
    set: (v: string) => void;
  } | null>(null);
  const focusField =
    (set: (v: string) => void) =>
    (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      activeFieldRef.current = { el: e.currentTarget, set };
    };
  const insertVariable = (key: string) => {
    const token = `{{${key}}}`;
    const active = activeFieldRef.current;
    if (!active) {
      void navigator.clipboard?.writeText(token);
      toast.success(`Copied ${token} — paste into a field`);
      return;
    }
    const el = active.el;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    active.set(el.value.slice(0, start) + token + el.value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const updateSection = (id: string, patch: Partial<Section>) =>
    setSections((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const addSection = () =>
    setSections((cur) => [
      ...cur,
      { id: `s_${Date.now()}`, heading: "New section", body: "" },
    ]);
  const removeSection = (id: string) =>
    setSections((cur) => (cur.length <= 1 ? cur : cur.filter((s) => s.id !== id)));
  const moveSection = (index: number, dir: -1 | 1) =>
    setSections((cur) => {
      const target = index + dir;
      if (target < 0 || target >= cur.length) return cur;
      const next = [...cur];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  // ---- Dirty tracking + save ----------------------------------------------
  const signature = React.useMemo(
    () =>
      JSON.stringify({
        title,
        category,
        description,
        scope,
        deliverables,
        timeline,
        terms,
        subject,
        body,
        sections: sections.map((s) => [s.heading, s.body]),
      }),
    [
      title,
      category,
      description,
      scope,
      deliverables,
      timeline,
      terms,
      subject,
      body,
      sections,
    ],
  );
  const [savedSignature, setSavedSignature] = React.useState(signature);
  const dirty = signature !== savedSignature;

  const saveAction = mode === "create" ? createTemplateAction : updateTemplateAction;
  const [state, action] = useActionState<
    TemplateActionResult<{ id: string }> | undefined,
    FormData
  >(saveAction, undefined);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (mode === "create" && state.data?.id) {
        toast.success("Template created");
        router.push(`/dashboard/templates/${state.data.id}`);
        return;
      }
      toast.success(state.message ?? "Template saved");
      setSavedSignature(signature);
    } else {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Ctrl/Cmd+S saves.
  const formRef = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [tab, setTab] = React.useState<"edit" | "preview">("edit");

  // Per-field validation errors returned by the server action.
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const errFor = (name: string): string | undefined => fieldErrors?.[name]?.[0];
  const errorList = fieldErrors
    ? (Object.entries(fieldErrors)
        .filter(([, msgs]) => Array.isArray(msgs) && msgs.length > 0)
        .map(([name, msgs]) => [name, msgs![0]] as const))
    : [];

  // Scroll to a specific field and focus it (switching to Edit on mobile).
  const jumpToField = React.useCallback((name: string) => {
    setTab("edit");
    const el = formRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `[name="${name}"]`,
    );
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    requestAnimationFrame(() => el.focus());
  }, []);

  // On a failed save, jump straight to the first field that needs fixing.
  React.useEffect(() => {
    if (!state || state.ok || !state.fieldErrors) return;
    const first = FIELD_ORDER.find((n) => state.fieldErrors?.[n]?.length);
    if (first) jumpToField(first);
  }, [state, jumpToField]);

  return (
    <form ref={formRef} action={action} className="space-y-5">
      {mode === "edit" && template ? (
        <input type="hidden" name="id" value={template.id} />
      ) : null}
      <input type="hidden" name="templateType" value={type} />

      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link href="/dashboard/templates">
              <ArrowLeft className="h-4 w-4" /> Templates
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="truncate text-3xl font-bold tracking-tight">
              {mode === "create" ? "New template" : "Edit template"}
            </h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {templateTypeLabel(type)}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground">
            Changes apply the next time you start a document from this template.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              "text-xs font-medium",
              dirty ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
            )}
          >
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <SaveButton mode={mode} dirty={dirty} />
        </div>
      </div>

      {errorList.length > 0 ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorList.length === 1
              ? "One field needs fixing"
              : `${errorList.length} fields need fixing`}
          </div>
          <ul className="mt-2 space-y-1">
            {errorList.map(([name, msg]) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => jumpToField(name)}
                  className="text-left text-sm text-destructive underline-offset-2 hover:underline"
                >
                  <span className="font-medium">{FIELD_LABELS[name] ?? name}</span>
                  {" — "}
                  {msg}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Mobile Edit / Preview toggle */}
      <div className="inline-flex rounded-lg bg-muted p-0.5 xl:hidden">
        <TabButton active={tab === "edit"} onClick={() => setTab("edit")} icon={PencilLine}>
          Edit
        </TabButton>
        <TabButton active={tab === "preview"} onClick={() => setTab("preview")} icon={Eye}>
          Preview
        </TabButton>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div
          className={cn(
            "min-w-0 space-y-5",
            tab === "edit" ? "block" : "hidden",
            "xl:block",
          )}
        >
          <Card>
            <CardContent className="grid gap-4 p-5">
              <Field label="Title" error={errFor("title")}>
                <Input
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onFocus={focusField(setTitle)}
                  placeholder="e.g. Website redesign proposal"
                  required
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Category" error={errFor("category")}>
                  <Input
                    name="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </Field>
                <Field label="Description" error={errFor("description")}>
                  <Input
                    name="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Where this template is useful."
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          {type === "proposal" ? (
            <Card>
              <CardContent className="grid gap-4 p-5">
                <Field label="Scope" error={errFor("scope")}>
                  <Textarea name="scope" rows={4} value={scope} onChange={(e) => setScope(e.target.value)} onFocus={focusField(setScope)} />
                </Field>
                <Field label="Deliverables" error={errFor("deliverables")}>
                  <Textarea name="deliverables" rows={4} value={deliverables} onChange={(e) => setDeliverables(e.target.value)} onFocus={focusField(setDeliverables)} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Timeline" error={errFor("timeline")}>
                    <Textarea name="timeline" rows={4} value={timeline} onChange={(e) => setTimeline(e.target.value)} onFocus={focusField(setTimeline)} />
                  </Field>
                  <Field label="Terms" error={errFor("terms")}>
                    <Textarea name="terms" rows={4} value={terms} onChange={(e) => setTerms(e.target.value)} onFocus={focusField(setTerms)} />
                  </Field>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {usesSections ? (
            <Card>
              <CardContent className="space-y-4 p-5">
                {type === "welcome_doc" ? (
                  <>
                    <Field label="Intro" error={errFor("body")}>
                      <Textarea name="body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} onFocus={focusField(setBody)} />
                    </Field>
                  </>
                ) : null}
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Sections</h2>
                  <Button type="button" variant="outline" size="sm" onClick={addSection}>
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
                <div className="space-y-3">
                  {sections.map((s, index) => (
                    <div key={s.id} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <Input
                          name="sectionHeading"
                          value={s.heading}
                          onChange={(e) => updateSection(s.id, { heading: e.target.value })}
                          placeholder="Section heading"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => moveSection(index, -1)}
                          disabled={index === 0}
                          aria-label="Move section up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => moveSection(index, 1)}
                          disabled={index === sections.length - 1}
                          aria-label="Move section down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSection(s.id)}
                          disabled={sections.length <= 1}
                          aria-label="Remove section"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        name="sectionBody"
                        className="mt-2"
                        rows={4}
                        value={s.body}
                        onChange={(e) => updateSection(s.id, { body: e.target.value })}
                        onFocus={focusField((v) => updateSection(s.id, { body: v }))}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {type === "email" || type === "invoice_note" ? (
            <Card>
              <CardContent className="grid gap-4 p-5">
                {type === "email" ? (
                  <Field label="Subject" error={errFor("subject")}>
                    <Input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} onFocus={focusField(setSubject)} />
                  </Field>
                ) : null}
                <Field label="Body" error={errFor("body")}>
                  <Textarea name="body" rows={7} value={body} onChange={(e) => setBody(e.target.value)} onFocus={focusField(setBody)} />
                </Field>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Merge fields + document-style preview */}
        <aside
          className={cn(
            "min-w-0 space-y-4",
            tab === "preview" ? "block" : "hidden",
            "xl:sticky xl:top-24 xl:block xl:self-start",
          )}
        >
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Merge fields
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Click to insert. These auto-fill from the client, project, and your
              profile when a document is started from this template.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {MERGE_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  title={`${v.label} — e.g. ${v.sample}`}
                  className="rounded-md border bg-background px-2 py-1 font-mono text-[11px] text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Preview
              </p>
              <span className="text-[10px] text-muted-foreground">
                sample values shown
              </span>
            </div>
            {/* Document "paper" */}
            <div className="space-y-4 bg-background p-6 text-sm">
              <h2 className="text-xl font-semibold tracking-tight">
                <Tokenized text={title || "Untitled template"} />
              </h2>
              {type === "proposal" ? (
                <>
                  <DocBlock heading="Scope" body={scope} />
                  <DocBlock heading="Deliverables" body={deliverables} />
                  <DocBlock heading="Timeline" body={timeline} />
                  <DocBlock heading="Terms" body={terms} />
                </>
              ) : usesSections ? (
                <>
                  {type === "welcome_doc" && body ? (
                    <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                      <Tokenized text={body} />
                    </p>
                  ) : null}
                  {sections.map((s) => (
                    <DocBlock key={s.id} heading={s.heading} body={s.body} />
                  ))}
                </>
              ) : (
                <>
                  {type === "email" && subject ? (
                    <p className="font-medium">
                      <Tokenized text={subject} />
                    </p>
                  ) : null}
                  <p className="whitespace-pre-line leading-relaxed text-foreground/90">
                    <Tokenized text={body || "Nothing here yet."} />
                  </p>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}

/** Render text with {{tokens}} highlighted and filled with their sample value. */
function Tokenized({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  const re = /\{\{\s*([a-z_]+)\s*\}\}/gi;
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const varKey = match[1].toLowerCase();
    const sample = SAMPLE_VALUES[varKey];
    nodes.push(
      <mark
        key={key++}
        className="rounded bg-primary/15 px-1 font-medium text-primary"
        title={`{{${varKey}}}`}
      >
        {sample ?? match[0]}
      </mark>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

function DocBlock({ heading, body }: { heading: string; body: string }) {
  if (!body?.trim()) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Tokenized text={heading} />
      </p>
      <p className="mt-1 whitespace-pre-line leading-relaxed text-foreground/90">
        <Tokenized text={body} />
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Eye;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function SaveButton({ mode, dirty }: { mode: "create" | "edit"; dirty: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending || (mode === "edit" && !dirty)}>
      {pending ? (
        "Saving..."
      ) : (
        <>
          <Save className="h-4 w-4" />
          {mode === "create" ? "Create template" : "Save"}
        </>
      )}
    </Button>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label
      className={cn(
        "space-y-1.5",
        error &&
          "[&_input]:border-destructive [&_input]:ring-1 [&_input]:ring-destructive [&_textarea]:border-destructive [&_textarea]:ring-1 [&_textarea]:ring-destructive",
      )}
    >
      <span
        className={cn(
          "text-xs font-medium",
          error ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      {children}
      {error ? <span className="block text-xs text-destructive">{error}</span> : null}
    </label>
  );
}
