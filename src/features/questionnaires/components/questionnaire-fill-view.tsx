"use client";

import * as React from "react";
import { Check, CheckCircle2, ClipboardList, Star } from "lucide-react";
import { toast } from "sonner";

import { submitQuestionnaireAction } from "../actions";
import type { Question } from "../types";

interface PublicSend {
  title: string;
  status: string;
  questions: Question[];
}

type Answer = string | string[];

function isEmpty(value: Answer | undefined): boolean {
  return (
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function QuestionnaireFillView({
  token,
  hostName,
  send,
}: {
  token: string;
  hostName: string;
  send: PublicSend;
}) {
  const [answers, setAnswers] = React.useState<Record<string, Answer>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(send.status === "completed");

  const setAnswer = (id: string, value: Answer) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  const answered = send.questions.filter((q) => !isEmpty(answers[q.id])).length;
  const progress = send.questions.length
    ? Math.round((answered / send.questions.length) * 100)
    : 0;

  const submit = async () => {
    for (const q of send.questions) {
      if (q.required && isEmpty(answers[q.id])) {
        toast.error(`Please answer: ${q.label}`);
        return;
      }
    }
    setSubmitting(true);
    const res = await submitQuestionnaireAction({ token, responses: answers });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDone(true);
    toast.success(res.message ?? "Submitted.");
  };

  const lightVars = {
    "--background": "0 0% 100%",
    "--foreground": "222 47% 11%",
    "--primary": "224 76% 40%",
    "--primary-foreground": "0 0% 100%",
    "--border": "214 32% 91%",
    colorScheme: "light",
  } as React.CSSProperties;

  return (
    <div
      className="relative min-h-screen bg-slate-50 text-slate-900"
      style={lightVars}
    >
      {/* Soft brand wash at the top of the canvas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{
          background: "linear-gradient(to bottom, #2563EB14, transparent)",
        }}
      />

      <main className="relative mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-micro font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm">
            <ClipboardList className="h-3.5 w-3.5 text-primary" />
            Questionnaire
          </div>
          <h1 className="mt-4 text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {send.title}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            from <span className="font-medium text-slate-700">{hostName}</span>
          </p>
        </header>

        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_32px_-12px_rgba(15,23,42,0.12)]">
          <div className="h-1.5 w-full bg-primary" />
          <div className="p-6 sm:p-8">
          {done ? (
            <div className="space-y-3 py-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <p className="text-xl font-semibold">Thank you!</p>
              <p className="mx-auto max-w-sm text-sm text-slate-500">
                Your answers were submitted to {hostName}. You can close this tab.
              </p>
            </div>
          ) : (
            <>
              {/* Progress */}
              <div className="mb-7">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {answered} of {send.questions.length} answered
                  </span>
                  <span className="font-semibold tabular-nums text-slate-700">
                    {progress}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="space-y-7">
                {send.questions.map((q, index) => (
                  <div key={q.id}>
                    <label className="block text-sm font-semibold text-slate-800">
                      {index + 1}. {q.label}
                      {q.required ? (
                        <span className="text-red-500"> *</span>
                      ) : null}
                    </label>
                    {q.help ? (
                      <p className="mt-0.5 text-xs text-slate-500">{q.help}</p>
                    ) : null}
                    <div className="mt-2">
                      <QuestionField
                        question={q}
                        value={answers[q.id]}
                        onChange={(value) => setAnswer(q.id, value)}
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="w-full rounded-lg bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Submit answers"}
                </button>
              </div>
            </>
          )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Powered by Stackivo · This page is private to you.
        </p>
      </main>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
  const strVal = typeof value === "string" ? value : "";

  switch (question.type) {
    case "long_text":
      return (
        <textarea
          rows={4}
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      );
    case "email":
      return (
        <input
          type="email"
          placeholder="name@example.com"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      );
    case "phone":
      return (
        <input
          type="tel"
          placeholder="+91 98765 43210"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      );
    case "number":
      return (
        <input
          type="number"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      );
    case "dropdown":
      return (
        <select
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        >
          <option value="">Select…</option>
          {(question.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    case "single_choice":
      return (
        <div className="space-y-2">
          {(question.options ?? []).map((opt) => (
            <OptionRow
              key={opt}
              label={opt}
              selected={value === opt}
              type="radio"
              onClick={() => onChange(opt)}
            />
          ))}
        </div>
      );
    case "multi_choice": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {(question.options ?? []).map((opt) => (
            <OptionRow
              key={opt}
              label={opt}
              selected={selected.includes(opt)}
              type="checkbox"
              onClick={() =>
                onChange(
                  selected.includes(opt)
                    ? selected.filter((o) => o !== opt)
                    : [...selected, opt],
                )
              }
            />
          ))}
        </div>
      );
    }
    case "yes_no":
      return (
        <div className="grid grid-cols-2 gap-2">
          {["Yes", "No"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={
                "rounded-lg border py-2.5 text-sm font-medium transition " +
                (value === opt
                  ? "border-primary bg-primary/5 text-primary"
                  : "text-slate-700 hover:border-primary/40")
              }
            >
              {opt}
            </button>
          ))}
        </div>
      );
    case "rating": {
      const max = question.max ?? 5;
      const current = Number(strVal) || 0;
      return (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              aria-label={`${n}`}
              className="p-0.5"
            >
              <Star
                className={
                  "h-7 w-7 " +
                  (current >= n
                    ? "fill-amber-400 text-amber-400"
                    : "text-slate-300")
                }
              />
            </button>
          ))}
        </div>
      );
    }
    case "date":
      return (
        <input
          type="date"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      );
    case "file":
      return (
        <input
          type="url"
          placeholder="Paste a link (Drive, Dropbox, etc.)"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      );
    default:
      return (
        <input
          type="text"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      );
  }
}

function OptionRow({
  label,
  selected,
  type,
  onClick,
}: {
  label: string;
  selected: boolean;
  type: "radio" | "checkbox";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition " +
        (selected
          ? "border-primary bg-primary/5 text-slate-900"
          : "text-slate-700 hover:border-primary/40")
      }
    >
      <span
        className={
          "flex h-5 w-5 shrink-0 items-center justify-center border " +
          (type === "radio" ? "rounded-full" : "rounded") +
          " " +
          (selected ? "border-primary bg-primary text-white" : "border-slate-300")
        }
      >
        {selected ? <Check className="h-3.5 w-3.5" /> : null}
      </span>
      {label}
    </button>
  );
}
