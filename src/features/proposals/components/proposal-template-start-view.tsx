"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, BookTemplate, CheckCircle2, FileText, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TemplateRecord } from "@/features/templates/builtin";
import { createProposalFromTemplateRedirectAction } from "../actions";

interface ClientOption {
  id: string;
  name: string;
  email: string | null;
  currency: string;
}

interface ProjectOption {
  id: string;
  name: string;
  clientId: string | null;
}

interface ProposalTemplateStartViewProps {
  templates: TemplateRecord[];
  clients: ClientOption[];
  projects: ProjectOption[];
}

const BLANK_TEMPLATE_ID = "blank";

export function ProposalTemplateStartView({
  templates,
  clients,
  projects,
}: ProposalTemplateStartViewProps) {
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(
    templates[0]?.id ?? BLANK_TEMPLATE_ID,
  );
  const [clientId, setClientId] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [title, setTitle] = React.useState(templates[0]?.title ?? "Untitled proposal");

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const personalTemplates = templates.filter((template) => !template.isSystem);
  const builtinTemplates = templates.filter((template) => template.isSystem);
  const selectedClient = clients.find((client) => client.id === clientId) ?? null;
  const availableProjects = React.useMemo(() => {
    if (!clientId) return projects;
    return projects.filter((project) => !project.clientId || project.clientId === clientId);
  }, [clientId, projects]);

  const chooseTemplate = (templateId: string, templateTitle: string) => {
    setSelectedTemplateId(templateId);
    setTitle(templateTitle);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="New proposal"
        description="Start with an offer template, then refine scope, pricing, and next steps in the builder."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/proposals">
              <ArrowLeft className="h-4 w-4" /> Proposals
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Start fresh
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <TemplateCard
                title="Blank proposal"
                description="Start with clean sections and add your own package, scope, and terms."
                selected={selectedTemplateId === BLANK_TEMPLATE_ID}
                badge="Flexible"
                icon={FileText}
                onClick={() =>
                  chooseTemplate(BLANK_TEMPLATE_ID, "Untitled proposal")
                }
              />
            </div>
          </div>

          {personalTemplates.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your templates
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {personalTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    title={template.title}
                    description={template.description ?? template.category}
                    selected={selectedTemplateId === template.id}
                    badge="Saved"
                    onClick={() => chooseTemplate(template.id, template.title)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {builtinTemplates.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Starter templates
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {builtinTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    title={template.title}
                    description={template.description ?? template.category}
                    selected={selectedTemplateId === template.id}
                    badge="Built-in"
                    onClick={() => chooseTemplate(template.id, template.title)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <Card className="xl:sticky xl:top-24 xl:self-start">
          <CardContent className="space-y-5 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Draft setup
              </p>
              <h2 className="mt-2 text-xl font-semibold">Prepare the offer</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Proposals are lightweight offers. Clients acknowledge them; contracts remain the
                legal e-signature step.
              </p>
            </div>

            <form action={createProposalFromTemplateRedirectAction} className="space-y-4">
              <input type="hidden" name="templateId" value={selectedTemplateId} />
              <input type="hidden" name="currency" value={selectedClient?.currency ?? "INR"} />

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Title
                </span>
                <Input
                  name="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Website redesign proposal"
                  required
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Client
                </span>
                <select
                  name="clientId"
                  value={clientId}
                  onChange={(event) => {
                    setClientId(event.target.value);
                    setProjectId("");
                  }}
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">No client yet</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                      {client.email ? ` (${client.email})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Project
                </span>
                <select
                  name="projectId"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">No project yet</option>
                  {availableProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-lg border bg-primary/5 p-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {selectedTemplate?.title ?? "Blank proposal"}
                </div>
                <p className="mt-1 leading-5">
                  You can change pricing, GST guidance, deliverables, and the conversion path in
                  the builder before sharing.
                </p>
              </div>

              <Button type="submit" className="w-full">
                <Sparkles className="h-4 w-4" /> Create draft proposal
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TemplateCard({
  title,
  description,
  selected,
  badge,
  icon: Icon = BookTemplate,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  badge: string;
  icon?: typeof BookTemplate;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group rounded-xl border bg-card p-5 text-left transition hover:border-primary/40 hover:shadow-sm",
        selected && "border-primary/60 bg-primary/5 ring-2 ring-primary/15",
      )}
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
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{description}</p>
    </button>
  );
}
