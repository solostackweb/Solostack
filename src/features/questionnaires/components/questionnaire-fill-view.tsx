"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardList, Star } from "lucide-react";
import { toast } from "sonner";

import { submitQuestionnaireAction } from "../actions";
import { followUpAnswerKey, OTHER_OPTION_VALUE, otherAnswerKey, type Question } from "../types";

interface PublicSend { title: string; description: string | null; layout: "guided" | "classic"; questions: Question[] }
type Answer = string | string[];
const newSubmissionKey = () => crypto.randomUUID();
const isEmpty = (value: Answer | undefined) => value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
const otherSelected = (question: Question, value: Answer | undefined) => value === OTHER_OPTION_VALUE || (Array.isArray(value) && value.includes(OTHER_OPTION_VALUE));

export function QuestionnaireFillView({ token, hostName, send }: { token: string; hostName: string; send: PublicSend }) {
  const [answers, setAnswers] = React.useState<Record<string, Answer>>({});
  const [respondentName, setRespondentName] = React.useState("");
  const [respondentEmail, setRespondentEmail] = React.useState("");
  const [detailsComplete, setDetailsComplete] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [submissionKey, setSubmissionKey] = React.useState(newSubmissionKey);
  const current = send.questions[step];
  const answered = send.questions.filter((question) => !isEmpty(answers[question.id])).length;
  const identityAnswered = Number(Boolean(respondentName.trim())) + Number(Boolean(respondentEmail.trim()));
  const totalFields = send.questions.length + 2;
  const progress = send.questions.length
    ? Math.round(((send.layout === "classic" ? answered + identityAnswered : detailsComplete ? step + 3 : identityAnswered) / totalFields) * 100)
    : 100;
  const setAnswer = (id: string, value: Answer) => setAnswers((previous) => ({ ...previous, [id]: value }));

  const validateQuestion = (question: Question) => {
    const value = answers[question.id];
    if (question.required && isEmpty(value)) {
      toast.error(`Please answer: ${question.label}`);
      document.getElementById(`question-${question.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    if (question.allowOther && otherSelected(question, value)) {
      const other = answers[otherAnswerKey(question.id)];
      if (typeof other !== "string" || !other.trim()) {
        toast.error("Please tell us what “Other” means.");
        return false;
      }
    }
    return true;
  };

  const next = () => {
    if (!current || !validateQuestion(current)) return;
    setStep((value) => Math.min(send.questions.length - 1, value + 1));
  };
  const validateRespondent = () => {
    if (!respondentName.trim()) {
      toast.error("Please enter your name.");
      document.getElementById("respondent-name")?.focus();
      return false;
    }
    const emailInput = document.getElementById("respondent-email") as HTMLInputElement | null;
    if (!respondentEmail.trim() || !emailInput?.checkValidity()) {
      toast.error("Please enter a valid email address.");
      emailInput?.focus();
      return false;
    }
    return true;
  };
  const continueFromDetails = () => {
    if (validateRespondent()) setDetailsComplete(true);
  };
  const submit = async () => {
    if (!validateRespondent()) return;
    for (const question of send.questions) if (!validateQuestion(question)) return;
    setSubmitting(true);
    const result = await submitQuestionnaireAction({
      token,
      submissionKey,
      respondentName,
      respondentEmail,
      responses: answers,
    });
    setSubmitting(false);
    if (!result.ok) return void toast.error(result.error);
    setDone(true);
    toast.success(result.message ?? "Submitted.");
  };
  const reset = () => {
    setAnswers({});
    setRespondentName("");
    setRespondentEmail("");
    setDetailsComplete(false);
    setStep(0);
    setSubmissionKey(newSubmissionKey());
    setDone(false);
  };
  const lightVars = { "--background": "0 0% 100%", "--foreground": "222 47% 11%", "--primary": "221 83% 53%", "--primary-foreground": "0 0% 100%", "--border": "214 32% 91%", colorScheme: "light" } as React.CSSProperties;

  return <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-950" style={lightVars}>
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,#dbeafe_0,transparent_68%)]" />
    <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-5 flex items-center justify-between gap-4">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm"><ClipboardList className="h-4 w-4" /></span>
          {hostName}
        </div>
        {!done && send.questions.length > 0 ? <span className="text-xs font-medium tabular-nums text-slate-500">{send.layout === "classic" ? `${answered + identityAnswered} of ${totalFields} answered` : `${detailsComplete ? step + 2 : 1} / ${send.questions.length + 1}`}</span> : null}
      </header>
      <section className={`flex flex-1 justify-center py-4 ${send.layout === "classic" ? "items-start" : "items-center"}`}>
        <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)]">
          {!done ? <div className="h-1 bg-slate-100"><div className="h-full bg-blue-600 transition-[width] duration-300" style={{ width: `${progress}%` }} /></div> : null}
          <div className="p-6 sm:p-10">
            {done ? <div className="mx-auto max-w-md space-y-4 py-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-7 w-7" /></div>
              <h1 className="text-2xl font-semibold tracking-tight">Response received</h1>
              <p className="text-sm leading-6 text-slate-600">Your answers were sent to {hostName}.</p>
              <button type="button" onClick={reset} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">Submit another response</button>
            </div> : send.layout === "classic" ? <ClassicForm send={send} answers={answers} setAnswer={setAnswer} respondentName={respondentName} respondentEmail={respondentEmail} setRespondentName={setRespondentName} setRespondentEmail={setRespondentEmail} submitting={submitting} onSubmit={submit} /> : !detailsComplete ? <RespondentDetails title={send.title} description={send.description} name={respondentName} email={respondentEmail} setName={setRespondentName} setEmail={setRespondentEmail} onContinue={continueFromDetails} /> : current ? <div className="mx-auto max-w-xl">
              {step === 0 ? <div className="mb-8 border-b border-slate-100 pb-6">
                <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{send.title}</h1>
                {send.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{send.description}</p> : null}
              </div> : null}
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Question {step + 1}</p>
              <h2 className="mt-2 text-balance text-xl font-semibold leading-snug text-slate-950 sm:text-2xl">{current.label}{current.required ? <span className="ml-1 text-red-500">*</span> : null}</h2>
              {current.help ? <p className="mt-2 text-sm leading-6 text-slate-500">{current.help}</p> : null}
              <div className="mt-6"><QuestionField question={current} answers={answers} setAnswer={setAnswer} /></div>
              <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <button type="button" onClick={() => step === 0 ? setDetailsComplete(false) : setStep((value) => value - 1)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /> Back</button>
                {step === send.questions.length - 1 ? <button type="button" onClick={submit} disabled={submitting} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">{submitting ? "Submitting…" : "Submit response"} <Check className="h-4 w-4" /></button> : <button type="button" onClick={next} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">Continue <ArrowRight className="h-4 w-4" /></button>}
              </div>
            </div> : <div className="py-10 text-center"><h1 className="text-xl font-semibold">This questionnaire has no questions yet.</h1></div>}
          </div>
        </div>
      </section>
      <p className="mt-4 text-center text-xs text-slate-400">Powered by Stackivo · Responses are shared privately.</p>
    </main>
  </div>;
}

function ClassicForm({
  send,
  answers,
  setAnswer,
  respondentName,
  respondentEmail,
  setRespondentName,
  setRespondentEmail,
  submitting,
  onSubmit,
}: {
  send: PublicSend;
  answers: Record<string, Answer>;
  setAnswer: (id: string, value: Answer) => void;
  respondentName: string;
  respondentEmail: string;
  setRespondentName: (value: string) => void;
  setRespondentEmail: (value: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="border-b border-slate-100 pb-6">
        <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{send.title}</h1>
        {send.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{send.description}</p> : null}
        <p className="mt-3 text-xs text-slate-500"><span className="text-red-500">*</span> Required</p>
      </div>
      <div className="border-b border-slate-100 py-7">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Your details</p>
        <div className="mt-4">
          <IdentityFields
            name={respondentName}
            email={respondentEmail}
            setName={setRespondentName}
            setEmail={setRespondentEmail}
          />
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {send.questions.map((question, index) => (
          <div id={`question-${question.id}`} key={question.id} className="scroll-mt-6 py-7 first:pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Question {index + 1}</p>
            <h2 className="mt-2 text-base font-semibold leading-6 text-slate-950 sm:text-lg">
              {question.label}{question.required ? <span className="ml-1 text-red-500">*</span> : null}
            </h2>
            {question.help ? <p className="mt-1 text-sm leading-6 text-slate-500">{question.help}</p> : null}
            <div className="mt-4"><QuestionField question={question} answers={answers} setAnswer={setAnswer} /></div>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 pt-6">
        <button type="button" onClick={onSubmit} disabled={submitting || send.questions.length === 0} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 sm:w-auto">
          {submitting ? "Submitting…" : "Submit response"} <Check className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function RespondentDetails({
  title,
  description,
  name,
  email,
  setName,
  setEmail,
  onContinue,
}: {
  title: string;
  description: string | null;
  name: string;
  email: string;
  setName: (value: string) => void;
  setEmail: (value: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-7 border-b border-slate-100 pb-6">
        <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Before you begin</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Tell us who you are</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Your details keep this response identifiable and are shared only with the questionnaire owner.</p>
      <div className="mt-6">
        <IdentityFields name={name} email={email} setName={setName} setEmail={setEmail} />
      </div>
      <div className="mt-8 flex justify-end border-t border-slate-100 pt-5">
        <button type="button" onClick={onContinue} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          Continue <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function IdentityFields({
  name,
  email,
  setName,
  setEmail,
}: {
  name: string;
  email: string;
  setName: (value: string) => void;
  setEmail: (value: string) => void;
}) {
  return (
    <div className="grid gap-5">
      <label className="grid gap-2 text-sm font-semibold text-slate-900" htmlFor="respondent-name">
        Name <span className="sr-only">required</span>
        <input id="respondent-name" name="name" type="text" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} className={inputCls} />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-900" htmlFor="respondent-email">
        Email <span className="sr-only">required</span>
        <input id="respondent-email" name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className={inputCls} />
      </label>
    </div>
  );
}

const inputCls = "min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100";

function QuestionField({ question, answers, setAnswer }: { question: Question; answers: Record<string, Answer>; setAnswer: (id: string, value: Answer) => void }) {
  const value = answers[question.id];
  const strVal = typeof value === "string" ? value : "";
  const change = (answer: Answer) => setAnswer(question.id, answer);
  const conditionalVisible = Boolean(question.conditionalFollowUp && value === question.conditionalFollowUp.when);
  const otherVisible = Boolean(question.allowOther && otherSelected(question, value));
  let field: React.ReactNode;
  switch (question.type) {
    case "long_text": field = <textarea rows={5} value={strVal} onChange={(event) => change(event.target.value)} className={`${inputCls} py-3`} />; break;
    case "email": field = <input type="email" placeholder="name@example.com" value={strVal} onChange={(event) => change(event.target.value)} className={inputCls} />; break;
    case "phone": field = <input type="tel" placeholder="+91 98765 43210" value={strVal} onChange={(event) => change(event.target.value)} className={inputCls} />; break;
    case "number": field = <input type="number" value={strVal} onChange={(event) => change(event.target.value)} className={inputCls} />; break;
    case "date": field = <input type="date" value={strVal} onChange={(event) => change(event.target.value)} className={inputCls} />; break;
    case "file": field = <input type="url" placeholder="Paste a Drive, Dropbox, or file link" value={strVal} onChange={(event) => change(event.target.value)} className={inputCls} />; break;
    case "dropdown": field = <select value={strVal} onChange={(event) => change(event.target.value)} className={inputCls}><option value="">Select an option…</option>{(question.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}{question.allowOther ? <option value={OTHER_OPTION_VALUE}>Other</option> : null}</select>; break;
    case "single_choice": field = <ChoiceList options={[...(question.options ?? []), ...(question.allowOther ? [OTHER_OPTION_VALUE] : [])]} value={value} multiple={false} onChange={change} />; break;
    case "multi_choice": field = <ChoiceList options={[...(question.options ?? []), ...(question.allowOther ? [OTHER_OPTION_VALUE] : [])]} value={value} multiple onChange={change} />; break;
    case "yes_no": field = <ChoiceList options={["Yes", "No"]} value={value} multiple={false} onChange={change} />; break;
    case "rating": {
      const current = Number(strVal) || 0;
      field = <div className="flex flex-wrap gap-2">{Array.from({ length: question.max ?? 5 }, (_, index) => index + 1).map((number) => <button key={number} type="button" onClick={() => change(String(number))} aria-label={`${number} out of ${question.max ?? 5}`} className="rounded-lg p-1 focus:outline-none focus:ring-2 focus:ring-blue-500"><Star className={`h-8 w-8 ${current >= number ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} /></button>)}</div>;
      break;
    }
    default: field = <input type="text" value={strVal} onChange={(event) => change(event.target.value)} className={inputCls} />;
  }
  return <div className="space-y-4">{field}
    {otherVisible ? <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4"><label className="mb-2 block text-sm font-semibold text-slate-800">Please specify</label><input autoFocus type="text" value={typeof answers[otherAnswerKey(question.id)] === "string" ? answers[otherAnswerKey(question.id)] as string : ""} onChange={(event) => setAnswer(otherAnswerKey(question.id), event.target.value)} className={inputCls} /></div> : null}
    {conditionalVisible && question.conditionalFollowUp ? <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4"><label className="mb-2 block text-sm font-semibold text-slate-900">{question.conditionalFollowUp.label}</label><textarea rows={4} placeholder={question.conditionalFollowUp.placeholder} value={typeof answers[followUpAnswerKey(question.id)] === "string" ? answers[followUpAnswerKey(question.id)] as string : ""} onChange={(event) => setAnswer(followUpAnswerKey(question.id), event.target.value)} className={`${inputCls} py-3`} /></div> : null}
  </div>;
}

function ChoiceList({ options, value, multiple, onChange }: { options: string[]; value: Answer | undefined; multiple: boolean; onChange: (value: Answer) => void }) {
  const selected = Array.isArray(value) ? value : [];
  return <div className="space-y-2.5">{options.map((option) => {
    const active = multiple ? selected.includes(option) : value === option;
    return <button key={option} type="button" onClick={() => onChange(multiple ? (active ? selected.filter((item) => item !== option) : [...selected, option]) : option)} className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-4 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${active ? "border-blue-600 bg-blue-50 text-slate-950" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50"}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center border ${multiple ? "rounded" : "rounded-full"} ${active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>{active ? <Check className="h-3.5 w-3.5" /> : null}</span>{option === OTHER_OPTION_VALUE ? "Other" : option}</button>;
  })}</div>;
}
