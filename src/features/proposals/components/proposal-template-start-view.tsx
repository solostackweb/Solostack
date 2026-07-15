"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, BookTemplate, FileText } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import type { TemplateRecord } from "@/features/templates/builtin";
import { createProposalFromTemplateRedirectAction } from "../actions";

interface ProposalTemplateStartViewProps {
  templates: TemplateRecord[];
  // Accepted for route compatibility; client/project are chosen in the builder.
  clients?: Array<{ id: string; name: string; email: string | null; currency: string }>;
  projects?: Array<{ id: string; name: string; clientId: string | null }>;
}

const BLANK_TEMPLATE_ID = "blank";

/**
 * "New proposal" starting point. Pick blank or a template and land straight in
 * the builder — client, pricing, and next steps are set there. No draft-setup
 * step; each card creates the draft and redirects.
 */
export function ProposalTemplateStartView({
  templates,
}: ProposalTemplateStartViewProps) {
  const personalTemplates = templates.filter((template) => !template.isSystem);
  const builtinTemplates = templates.filter((template) => template.isSystem);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New proposal"
        description="Pick a starting point — you'll set the client, pricing, and next steps in the builder."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/proposals">
              <ArrowLeft className="h-4 w-4" /> Proposals
            </Link>
          </Button>
        }
      />

      <Section label="Start fresh">
        <StartCard
          templateId={BLANK_TEMPLATE_ID}
          titleValue="Untitled proposal"
          title="Blank proposal"
          description="Start with clean sections and add your own package, scope, and terms."
          badge="Flexible"
          icon={FileText}
        />
      </Section>

      {personalTemplates.length > 0 ? (
        <Section label="Your templates">
          {personalTemplates.map((template) => (
            <StartCard
              key={template.id}
              templateId={template.id}
              titleValue={template.title}
              title={template.title}
              description={template.description ?? template.category}
              badge="Saved"
            />
          ))}
        </Section>
      ) : null}

      {builtinTemplates.length > 0 ? (
        <Section label="Starter templates">
          {builtinTemplates.map((template) => (
            <StartCard
              key={template.id}
              templateId={template.id}
              titleValue={template.title}
              title={template.title}
              description={template.description ?? template.category}
              badge="Built-in"
            />
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function StartCard({
  templateId,
  titleValue,
  title,
  description,
  badge,
  icon: Icon = BookTemplate,
}: {
  templateId: string;
  titleValue: string;
  title: string;
  description: string;
  badge: string;
  icon?: typeof BookTemplate;
}) {
  return (
    <form action={createProposalFromTemplateRedirectAction} className="h-full">
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="title" value={titleValue} />
      <input type="hidden" name="currency" value="INR" />
      <button
        type="submit"
        className="group flex h-full w-full flex-col rounded-xl border bg-card p-5 text-left transition hover:border-primary/40 hover:shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-background text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <span className="rounded-full border bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {badge}
          </span>
        </div>
        <h3 className="mt-4 text-base font-semibold">{title}</h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </button>
    </form>
  );
}
