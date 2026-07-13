"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Copy, ExternalLink, FolderKanban, Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IvoContextActions } from "@/features/ai-workflows/components/ivo-context-actions";
import {
  createLeadFormAction,
  toggleLeadFormAction,
  type LeadFormActionResult,
} from "../actions";
import type { LeadFormRecord, LeadSubmissionRecord } from "../server";

export function LeadFormsView({
  forms,
  submissions,
  publicBaseUrl,
}: {
  forms: LeadFormRecord[];
  submissions: LeadSubmissionRecord[];
  publicBaseUrl: string;
}) {
  const [state, action] = useActionState<
    LeadFormActionResult<{ id: string; url: string }> | undefined,
    FormData
  >(
    createLeadFormAction,
    undefined,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Clientflow intake
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Lead forms</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Capture new inquiries, create a client automatically, and drop the work
            straight into Projects as a lead.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/projects">
            <FolderKanban className="h-4 w-4" />
            View projects
          </Link>
        </Button>
      </header>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <form action={action} className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Plus className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Create intake form</h2>
              <p className="text-xs text-muted-foreground">
                Share the public link with prospects or place it on your website.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Internal name</span>
              <Input name="name" placeholder="Website project inquiries" required />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Public title</span>
              <Input name="title" placeholder="Tell me about your project" required />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              <Textarea
                name="description"
                rows={3}
                placeholder="Share what kind of work you are accepting."
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Brand colour</span>
              <div className="flex gap-2">
                <Input name="brandColor" type="color" defaultValue="#2563EB" className="w-16 p-1" />
                <Input defaultValue="#2563EB" aria-label="Brand colour preview" readOnly />
              </div>
            </label>
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
          <SubmitButton label="Create form" className="mt-4 w-full" />
        </form>

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Active forms</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Toggle forms off when you are not accepting new inquiries.
          </p>
          <div className="mt-4 space-y-3">
            {forms.length === 0 ? (
              <EmptyState icon={Inbox} title="No lead forms yet" text="Create your first intake form to start capturing leads." />
            ) : (
              forms.map((form) => {
                const url = `${publicBaseUrl}/lead/${form.slug}`;
                return (
                  <article key={form.id} className="rounded-xl border bg-background p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold">{form.name}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            form.active
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {form.active ? "Active" : "Paused"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{form.title}</p>
                        <p className="mt-2 truncate rounded-lg bg-muted px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
                          {url}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void navigator.clipboard?.writeText(url)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/lead/${form.slug}`} target="_blank">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open
                          </Link>
                        </Button>
                        <form action={toggleLeadFormAction}>
                          <input type="hidden" name="id" value={form.id} />
                          <input type="hidden" name="active" value={String(!form.active)} />
                          <Button variant="secondary" size="sm">
                            {form.active ? "Pause" : "Activate"}
                          </Button>
                        </form>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Recent submissions</h2>
            <p className="text-xs text-muted-foreground">
              Each submission creates a client and a lead-stage project.
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {submissions.length} captured
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {submissions.length === 0 ? (
            <EmptyState icon={Inbox} title="No submissions yet" text="New inquiries will appear here as soon as prospects submit your form." />
          ) : (
            submissions.map((submission) => (
              <article key={submission.id} className="rounded-xl border bg-background p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {submission.name}
                      {submission.company ? ` · ${submission.company}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {submission.email}
                      {submission.phone ? ` · ${submission.phone}` : ""}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {submission.project_summary}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {submission.form?.name ?? "Lead form"} · {new Date(submission.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {submission.project_id ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href="/dashboard/projects">Projects</Link>
                      </Button>
                    ) : null}
                    <IvoContextActions
                      title="Lead response"
                      actions={[
                        {
                          label: "Draft reply",
                          prompt: submission.ivo_prompt,
                        },
                      ]}
                      className="border-0 bg-transparent p-0 shadow-none"
                    />
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function SubmitButton({ label, className }: { label: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button className={className} disabled={pending}>
      {pending ? "Working..." : label}
    </Button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center">
      <Icon className="mx-auto h-8 w-8 text-muted-foreground/35" />
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
        {text}
      </p>
    </div>
  );
}
