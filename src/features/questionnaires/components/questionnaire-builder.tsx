"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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

  const addQuestion = () =>
    setQuestions((prev) => [
      ...prev,
      { id: newQuestionId(), type: "short_text", label: "", required: false },
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
        description="Build a reusable intake form, then send it to any client from their profile."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/questionnaires">
                <ArrowLeft className="h-4 w-4" /> Questionnaires
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
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Title
            </span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Web design intake"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Description (optional)
            </span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="A short intro shown at the top of the form."
            />
          </label>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {questions.map((q, index) => (
          <Card key={q.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-2 text-xs font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <div className="flex-1 space-y-3">
                  <Input
                    value={q.label}
                    onChange={(e) =>
                      updateQuestion(q.id, { label: e.target.value })
                    }
                    placeholder="Question text"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={q.type}
                      onChange={(e) =>
                        changeType(q.id, e.target.value as QuestionType)
                      }
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                    >
                      {QUESTION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {QUESTION_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) =>
                          updateQuestion(q.id, { required: e.target.checked })
                        }
                        className="h-4 w-4"
                      />
                      Required
                    </label>
                    {q.type === "rating" ? (
                      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        Scale to
                        <Input
                          type="number"
                          min={2}
                          max={10}
                          value={q.max ?? 5}
                          onChange={(e) =>
                            updateQuestion(q.id, {
                              max: Number(e.target.value || 5),
                            })
                          }
                          className="h-9 w-16"
                        />
                      </label>
                    ) : null}
                  </div>

                  {questionNeedsOptions(q.type) ? (
                    <OptionsEditor
                      options={q.options ?? []}
                      onChange={(options) => updateQuestion(q.id, { options })}
                    />
                  ) : null}
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => move(q.id, "up")}
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
                    onClick={() => move(q.id, "down")}
                    disabled={index === questions.length - 1}
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeQuestion(q.id)}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button type="button" variant="outline" onClick={addQuestion}>
          <Plus className="h-4 w-4" /> Add question
        </Button>
      </div>
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
