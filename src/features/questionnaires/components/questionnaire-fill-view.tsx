"use client";

import * as React from "react";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { toast } from "sonner";

import { submitQuestionnaireAction } from "../actions";
import type { Question } from "../types";

interface PublicSend {
  title: string;
  status: string;
  questions: Question[];
}

type Answer = string | string[];

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

  const submit = async () => {
    for (const q of send.questions) {
      if (!q.required) continue;
      const value = answers[q.id];
      const empty =
        value === undefined ||
        value === "" ||
        (Array.isArray(value) && value.length === 0);
      if (empty) {
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
    <div className="min-h-screen bg-slate-50 text-slate-900" style={lightVars}>
      <header
        className="px-5 pb-14 pt-12 text-white sm:px-10 sm:pt-16"
        style={{ background: "linear-gradient(135deg, #2563EB, #0F172A)" }}
      >
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] opacity-80">
            <ClipboardList className="h-3.5 w-3.5" />
            Questionnaire
          </div>
          <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {send.title}
          </h1>
          <p className="mt-1 text-sm opacity-90">from {hostName}</p>
        </div>
      </header>

      <main className="mx-auto -mt-6 max-w-2xl px-5 pb-16 sm:px-10">
        <div className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
          {done ? (
            <div className="space-y-3 py-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-lg font-semibold">Thank you!</p>
              <p className="mx-auto max-w-sm text-sm text-slate-500">
                Your answers were submitted to {hostName}. You can close this tab.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {send.questions.map((q, index) => (
                <div key={q.id} className="space-y-2">
                  <label className="block text-sm font-medium text-slate-800">
                    {index + 1}. {q.label}
                    {q.required ? (
                      <span className="text-red-500"> *</span>
                    ) : null}
                  </label>
                  <QuestionField
                    question={q}
                    value={answers[q.id]}
                    onChange={(value) => setAnswer(q.id, value)}
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit answers"}
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Powered by Stackivo · This page is private to you.
        </p>
      </main>
    </div>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
  const input =
    "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none";

  switch (question.type) {
    case "long_text":
      return (
        <textarea
          rows={4}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={input}
        />
      );
    case "dropdown":
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={input}
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
        <div className="space-y-1.5">
          {(question.options ?? []).map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 text-sm text-slate-700"
            >
              <input
                type="radio"
                name={question.id}
                checked={value === opt}
                onChange={() => onChange(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      );
    case "multi_choice": {
      const selected = Array.isArray(value) ? value : [];
      const toggle = (opt: string) =>
        onChange(
          selected.includes(opt)
            ? selected.filter((o) => o !== opt)
            : [...selected, opt],
        );
      return (
        <div className="space-y-1.5">
          {(question.options ?? []).map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }
    case "yes_no":
      return (
        <div className="flex gap-4">
          {["Yes", "No"].map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 text-sm text-slate-700"
            >
              <input
                type="radio"
                name={question.id}
                checked={value === opt}
                onChange={() => onChange(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      );
    case "rating": {
      const max = question.max ?? 5;
      const current = typeof value === "string" ? Number(value) : 0;
      return (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              className={
                "h-9 w-9 rounded-full border text-sm font-medium transition " +
                (current === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-slate-700 hover:border-primary")
              }
            >
              {n}
            </button>
          ))}
        </div>
      );
    }
    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={input}
        />
      );
    case "file":
      return (
        <input
          type="url"
          placeholder="Paste a link (Drive, Dropbox, etc.)"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={input}
        />
      );
    default:
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={input}
        />
      );
  }
}
