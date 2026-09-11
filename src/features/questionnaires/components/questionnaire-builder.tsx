"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlignLeft,
  ArrowLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Hash,
  Link2,
  List,
  Mail,
  Phone,
  PanelTop,
  Plus,
  Save,
  BookmarkPlus,
  Star,
  ToggleLeft,
  Trash2,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SmartField } from "@/features/ai-workflows/components/smart-field";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  QUESTION_TYPE_LABEL,
  QUESTION_TYPES,
  newQuestionId,
  questionNeedsOptions,
  type Question,
  type QuestionType,
  type Questionnaire,
  type QuestionnairePublicLayout,
} from "../types";
import {
  createQuestionnaireAction,
  saveQuestionnaireAsTemplateAction,
  updateQuestionnaireAction,
} from "../actions";

const TYPE_ICON: Record<QuestionType, LucideIcon> = {
  short_text: Type,
  long_text: AlignLeft,
  email: Mail,
  phone: Phone,
  number: Hash,
  single_choice: CircleDot,
  multi_choice: CheckSquare,
  dropdown: List,
  yes_no: ToggleLeft,
  rating: Star,
  date: Calendar,
  file: Link2,
};

export function QuestionnaireBuilder({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: Questionnaire;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [description, setDescription] = React.useState(
    initial?.description ?? "",
  );
  const [questions, setQuestions] = React.useState<Question[]>(
    initial?.questions ?? [],
  );
  const [publicLayout, setPublicLayout] = React.useState<QuestionnairePublicLayout>(
    initial?.publicLayout ?? "guided",
  );
  const [collectRespondentIdentity, setCollectRespondentIdentity] = React.useState(
    initial?.collectRespondentIdentity ?? true,
  );
  const [saving, setSaving] = React.useState(false);
  const [savingTemplate, setSavingTemplate] = React.useState(false);

  const addQuestion = (type: QuestionType) =>
    setQuestions((prev) => [
      ...prev,
      {
        id: newQuestionId(),
        type,
        label: "",
        required: false,
        options: questionNeedsOptions(type)
          ? ["Option 1", "Option 2"]
          : undefined,
        max: type === "rating" ? 5 : undefined,
      },
    ]);

  const updateQuestion = (id: string, patch: Partial<Question>) =>
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    );

  const removeQuestion = (id: string) =>
    setQuestions((prev) => prev.filter((q) => q.id !== id));

  const move = (id: string, dir: "up" | "down") =>
    setQuestions((prev) => {
      const i = prev.findIndex((q) => q.id === id);
      const j = dir === "up" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const changeType = (id: string, type: QuestionType) =>
    updateQuestion(id, {
      type,
      options: questionNeedsOptions(type)
        ? questions.find((q) => q.id === id)?.options ?? ["Option 1", "Option 2"]
        : undefined,
      max: type === "rating" ? 5 : undefined,
      allowOther: questionNeedsOptions(type)
        ? questions.find((q) => q.id === id)?.allowOther ?? false
        : undefined,
      conditionalFollowUp:
        type === "yes_no"
          ? questions.find((q) => q.id === id)?.conditionalFollowUp
          : undefined,
      endFormOn:
        type === "yes_no" ? questions.find((q) => q.id === id)?.endFormOn : undefined,
    });

  const saveAsTemplate = async () => {
    if (!initial) return;
    if (!title.trim()) return void toast.error("Give your questionnaire a title.");
    const cleaned = questions.filter((question) => question.label.trim().length > 0);
    if (cleaned.length === 0) return void toast.error("Add at least one question.");
    setSavingTemplate(true);
    const saved = await updateQuestionnaireAction({
      id: initial.id,
      title: title.trim(),
      description: description.trim() || undefined,
      publicLayout,
      collectRespondentIdentity,
      questions: cleaned.map((question) => ({
        ...question,
        options: questionNeedsOptions(question.type)
          ? (question.options ?? []).filter((option) => option.trim().length > 0)
          : undefined,
      })),
    });
    if (!saved.ok) {
      setSavingTemplate(false);
      return void toast.error(saved.error);
    }
    const result = await saveQuestionnaireAsTemplateAction(initial.id);
    setSavingTemplate(false);
    if (result.ok) toast.success(result.message);
    else toast.error(result.error);
  };

  const save = async () => {
    if (!title.trim()) {
      toast.error("Give your questionnaire a title.");
      return;
    }
    const cleaned = questions.filter((q) => q.label.trim().length > 0);
    if (cleaned.length === 0) {
      toast.error("Add at least one question.");
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      publicLayout,
      collectRespondentIdentity,
      questions: cleaned.map((q) => ({
        ...q,
        options: questionNeedsOptions(q.type)
          ? (q.options ?? []).filter((o) => o.trim().length > 0)
          : undefined,
      })),
    };
    const res =
      mode === "edit" && initial
        ? await updateQuestionnaireAction({ ...payload, id: initial.id })
        : await createQuestionnaireAction(payload);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Saved.");
    if (mode === "create" && res.ok && "data" in res && res.data) {
      router.push(`/dashboard/questionnaires/${res.data.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "edit" ? "Edit questionnaire" : "New questionnaire"}
        description="Build a reusable intake form, then send it to any client."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/questionnaires">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
            </Button>
            {mode === "edit" ? (
              <Button variant="outline" size="sm" onClick={saveAsTemplate} disabled={savingTemplate}>
                <BookmarkPlus className="h-4 w-4" /> {savingTemplate ? "Saving…" : "Save as template"}
              </Button>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-6">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Questionnaire title"
            className="h-11 text-lg font-semibold"
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="A short intro shown at the top of the form (optional)."
          />
          <div className="border-t pt-4">
            <div className="mb-3">
              <p className="text-sm font-semibold">Public form layout</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose how respondents move through this questionnaire.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Public form layout">
              <LayoutChoice
                selected={publicLayout === "guided"}
                icon={PanelTop}
                title="One at a time"
                description="Focused steps with progress and Back / Continue controls."
                onSelect={() => setPublicLayout("guided")}
              />
              <LayoutChoice
                selected={publicLayout === "classic"}
                icon={List}
                title="One page"
                description="A familiar scrolling form with every question visible."
                onSelect={() => setPublicLayout("classic")}
              />
            </div>
          </div>
          <div className="border-t pt-4">
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-muted/20 p-4">
              <input
                type="checkbox"
                checked={collectRespondentIdentity}
                onChange={(event) => setCollectRespondentIdentity(event.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-semibold">Collect respondent name and email</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  Adds a required details step before the questionnaire. Turn this off for anonymous responses.
                </span>
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {questions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No questions yet. Add your first question below.
          </div>
        ) : null}

        {questions.map((q, index) => (
          <QuestionCard
            key={q.id}
            index={index}
            total={questions.length}
            question={q}
            onChange={(patch) => updateQuestion(q.id, patch)}
            onChangeType={(t) => changeType(q.id, t)}
            onMove={(dir) => move(q.id, dir)}
            onRemove={() => removeQuestion(q.id)}
          />
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="w-full">
              <Plus className="h-4 w-4" /> Add question
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {QUESTION_TYPES.map((type) => {
              const Icon = TYPE_ICON[type];
              return (
                <DropdownMenuItem
                  key={type}
                  onSelect={() => addQuestion(type)}
                >
                  <Icon className="h-4 w-4" /> {QUESTION_TYPE_LABEL[type]}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function LayoutChoice({
  selected,
  icon: Icon,
  title,
  description,
  onSelect,
}: {
  selected: boolean;
  icon: LucideIcon;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={
        "flex min-h-20 items-start gap-3 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
        (selected
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:border-primary/40")
      }
    >
      <span className={"mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md " + (selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function QuestionCard({
  index,
  total,
  question,
  onChange,
  onChangeType,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  question: Question;
  onChange: (patch: Partial<Question>) => void;
  onChangeType: (type: QuestionType) => void;
  onMove: (dir: "up" | "down") => void;
  onRemove: () => void;
}) {
  const Icon = TYPE_ICON[question.type];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex flex-col items-center gap-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-micro font-semibold text-muted-foreground">
              {index + 1}
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <Input
              value={question.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="Question"
              className="font-medium"
            />
            <SmartField
              kind="questionnaire_question"
              value={question.label}
              onApply={(label) => onChange({ label })}
            />
            <Input
              value={question.help ?? ""}
              onChange={(e) => onChange({ help: e.target.value })}
              placeholder="Help text (optional)"
              className="h-9 text-sm"
            />

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-lg border bg-background px-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <select
                  value={question.type}
                  onChange={(e) => onChangeType(e.target.value as QuestionType)}
                  className="h-9 bg-transparent text-sm focus:outline-none"
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {QUESTION_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={question.required}
                  onChange={(e) => onChange({ required: e.target.checked })}
                  className="h-4 w-4"
                />
                Required
              </label>

              {question.type === "rating" ? (
                <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  Scale
                  <Input
                    type="number"
                    min={2}
                    max={10}
                    value={question.max ?? 5}
                    onChange={(e) =>
                      onChange({ max: Number(e.target.value || 5) })
                    }
                    className="h-9 w-16"
                  />
                </label>
              ) : null}
            </div>

            {questionNeedsOptions(question.type) ? (
              <div className="space-y-3">
                <OptionsEditor
                  options={question.options ?? []}
                  onChange={(options) => onChange({ options })}
                />
                <label className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={Boolean(question.allowOther)}
                    onChange={(event) => onChange({ allowOther: event.target.checked })}
                    className="h-4 w-4"
                  />
                  Add an “Other” option with a text field
                </label>
              </div>
            ) : null}

            {question.type === "yes_no" ? (
              <ConditionalFollowUpEditor question={question} onChange={onChange} />
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onMove("up")}
              disabled={index === 0}
              aria-label="Move up"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onMove("down")}
              disabled={index === total - 1}
              aria-label="Move down"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={onRemove}
              aria-label="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConditionalFollowUpEditor({
  question,
  onChange,
}: {
  question: Question;
  onChange: (patch: Partial<Question>) => void;
}) {
  const enabled = Boolean(question.conditionalFollowUp);
  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <label className="grid gap-1 text-xs font-medium text-muted-foreground sm:max-w-sm">
        End this form early
        <select
          value={question.endFormOn ?? ""}
          onChange={(event) => onChange({ endFormOn: (event.target.value || undefined) as "Yes" | "No" | undefined })}
          className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground"
        >
          <option value="">Never — continue to the next question</option>
          <option value="No">When No is chosen</option>
          <option value="Yes">When Yes is chosen</option>
        </select>
        <span className="font-normal leading-5">The response is submitted at this point and later questions are skipped.</span>
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) =>
            onChange({
              conditionalFollowUp: event.target.checked
                ? { when: "Yes", label: "Please tell us more" }
                : undefined,
            })
          }
          className="h-4 w-4"
        />
        Reveal a short paragraph follow-up
      </label>
      {question.conditionalFollowUp ? (
        <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Show when
            <select
              value={question.conditionalFollowUp.when}
              onChange={(event) =>
                onChange({
                  conditionalFollowUp: {
                    ...question.conditionalFollowUp!,
                    when: event.target.value as "Yes" | "No",
                  },
                })
              }
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground"
            >
              <option value="Yes">Yes is chosen</option>
              <option value="No">No is chosen</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Follow-up prompt
            <Input
              value={question.conditionalFollowUp.label}
              onChange={(event) =>
                onChange({
                  conditionalFollowUp: {
                    ...question.conditionalFollowUp!,
                    label: event.target.value,
                  },
                })
              }
              placeholder="Please tell us more"
              className="h-10"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (options: string[]) => void;
}) {
  const update = (i: number, value: string) =>
    onChange(options.map((o, idx) => (idx === i ? value : o)));
  const remove = (i: number) => onChange(options.filter((_, idx) => idx !== i));
  const add = () => onChange([...options, `Option ${options.length + 1}`]);

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Options
      </p>
      {options.map((option, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{i + 1}.</span>
          <Input
            value={option}
            onChange={(e) => update(i, e.target.value)}
            className="h-9"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => remove(i)}
            aria-label="Remove option"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5" /> Add option
      </Button>
    </div>
  );
}
