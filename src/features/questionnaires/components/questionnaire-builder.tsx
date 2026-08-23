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
  Plus,
  Save,
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
} from "../types";
import {
  createQuestionnaireAction,
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
  const [saving, setSaving] = React.useState(false);

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
    });

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
              <OptionsEditor
                options={question.options ?? []}
                onChange={(options) => onChange({ options })}
              />
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
