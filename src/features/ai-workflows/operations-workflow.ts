import "server-only";

import type { ClientRecord } from "@/features/clients/server";
import { getClientDisplayName } from "@/features/clients/utils";
import type { ProjectRecord } from "@/features/projects/server";
import { generateStructuredJson } from "./groq";
import {
  aiClientDraftSchema,
  aiContractDraftSchema,
  aiPortalDraftSchema,
  aiProjectDraftSchema,
  aiTimeEntryDraftSchema,
  aiWelcomeDraftSchema,
  type AiClientDraft,
  type AiContractDraft,
  type AiPortalDraft,
  type AiProjectDraft,
  type AiTimeEntryDraft,
  type AiWelcomeDraft,
} from "./types";

export type OperationsWorkflow =
  | "client"
  | "project"
  | "portal"
  | "time_entry"
  | "contract"
  | "welcome_document";

export type OperationsDraft =
  | AiClientDraft
  | AiProjectDraft
  | AiPortalDraft
  | AiTimeEntryDraft
  | AiContractDraft
  | AiWelcomeDraft;

interface DraftContext {
  prompt: string;
  clientId?: string;
  projectId?: string;
  clients: ClientRecord[];
  projects: ProjectRecord[];
  defaultHourlyRate?: number;
}

const today = () => new Date().toISOString().slice(0, 10);

function findClient(ctx: DraftContext) {
  return ctx.clientId
    ? ctx.clients.find((client) => client.id === ctx.clientId) ?? null
    : null;
}

function findProject(ctx: DraftContext) {
  return ctx.projectId
    ? ctx.projects.find((project) => project.id === ctx.projectId) ?? null
    : null;
}

function firstLine(prompt: string, fallback: string) {
  const line = prompt
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find(Boolean);
  return (line || fallback).slice(0, 160);
}

function selectedContext(ctx: DraftContext) {
  const client = findClient(ctx);
  const project = findProject(ctx);
  return {
    client,
    project,
    clientName: client ? getClientDisplayName(client) : "",
    projectName: project?.name ?? "",
  };
}

function localDraft(workflow: OperationsWorkflow, ctx: DraftContext): OperationsDraft {
  const { client, project, clientName, projectName } = selectedContext(ctx);
  const prompt = ctx.prompt.trim();

  switch (workflow) {
    case "client":
      return {
        fullName: firstLine(prompt, "New client"),
        businessName: "",
        email: "",
        phone: "",
        billingAddress: "",
        notes: prompt,
      };
    case "project":
      return {
        name: firstLine(prompt, "New project"),
        description: prompt,
        clientId: client?.id ?? "",
        startDate: today(),
        dueDate: "",
      };
    case "portal":
      return {
        name: `${client ? getClientDisplayName(client) : firstLine(prompt, "Client")} Portal`,
        clientId: client?.id ?? "",
        brandColor: "#2563EB",
      };
    case "time_entry":
      return {
        description: firstLine(prompt, "Client work"),
        projectId: project?.id ?? "",
        date: today(),
        hours: 1,
        minutes: 0,
        billable: true,
        hourlyRate: ctx.defaultHourlyRate ?? 0,
      };
    case "contract":
      return {
        title: projectName
          ? `${projectName} Service Agreement`
          : clientName
            ? `${clientName} Service Agreement`
            : firstLine(prompt, "Service agreement"),
        kind: "contract",
        clientId: client?.id ?? "",
        projectId: project?.id ?? "",
        valueAmount: undefined,
        sections: [
          {
            heading: "Parties and Purpose",
            body: `This agreement sets out the working terms between the service provider and ${clientName || "the client"}${projectName ? ` for ${projectName}` : ""}.`,
          },
          {
            heading: "Scope of Work",
            body: prompt || "The service provider will deliver the services agreed in writing by both parties.",
          },
          {
            heading: "Timeline and Milestones",
            body: "The parties will confirm milestones, review dates, and delivery timelines in writing before work begins.",
          },
          {
            heading: "Fees and Payment Terms",
            body: "Invoices are payable according to the agreed commercial terms. Late payment may pause further work until the account is brought up to date.",
          },
          {
            heading: "Revisions and Change Requests",
            body: "Work outside the agreed scope, additional revision rounds, or material changes will be quoted separately and require written approval.",
          },
          {
            heading: "Intellectual Property and Usage",
            body: "Final approved deliverables transfer according to the agreed payment and usage terms. Drafts, unused concepts, and internal working files remain with the service provider unless agreed otherwise.",
          },
          {
            heading: "Termination",
            body: "Either party may terminate the agreement with written notice. Work completed, approved expenses, and committed fees up to termination remain payable.",
          },
        ],
      };
    case "welcome_document":
      return {
        title: clientName ? `Welcome to ${clientName}` : firstLine(prompt, "Welcome document"),
        intro: "Welcome aboard. This guide explains how we will work together, what to expect next, and how to keep the project moving smoothly.",
        clientId: client?.id ?? "",
        acknowledgementRequired: false,
        sections: [
          {
            heading: "How We Will Work Together",
            body: prompt || "We will communicate clearly, document key decisions, and keep progress visible throughout the engagement.",
          },
          {
            heading: "Communication",
            body: "Please use the agreed communication channel for feedback, approvals, and project questions so nothing gets missed.",
          },
          {
            heading: "Timeline and Feedback",
            body: "Timelines depend on prompt feedback and access to required materials. Consolidated feedback helps avoid delays and keeps delivery predictable.",
          },
          {
            heading: "Payments and Invoices",
            body: "Invoices, payment links, and billing updates will be shared through Stackivo or the agreed payment channel.",
          },
          {
            heading: "Files and Deliverables",
            body: "Final deliverables will be shared in the agreed formats. Please download and store copies after delivery.",
          },
          {
            heading: "Next Steps",
            body: "Review this guide, share any required access or materials, and confirm the kickoff details.",
          },
        ],
      };
  }
}

function workflowInstructions(workflow: OperationsWorkflow) {
  switch (workflow) {
    case "contract":
      return [
        "Draft a polished, practical business agreement for freelancers/agencies.",
        "The title must be specific, professional, and tied to the client/project/context when available.",
        "Create 7 to 10 sections with clear legal/business headings.",
        "Each section body should be substantive: usually 2 to 5 sentences, with precise operational terms.",
        "Include relevant sections such as Parties and Purpose, Scope of Work, Deliverables, Timeline, Fees and Payment Terms, Revisions/Change Requests, Client Responsibilities, Confidentiality, Intellectual Property, Termination, and Dispute/General Terms.",
        "Use plain business/legal language; avoid placeholders like [insert], lorem ipsum, vague filler, or markdown tables.",
        "Do not claim to be legal advice. Do not invent addresses, government IDs, bank details, or private facts.",
        "Set kind to proposal only when the user explicitly asks for a proposal or the context says proposal; otherwise use contract.",
        "Extract valueAmount only when a clear numeric fee is provided.",
      ].join(" ");
    case "welcome_document":
      return [
        "Draft a premium client welcome/onboarding document that feels ready to send.",
        "The title must be client/project-specific when context is available.",
        "Write a warm but professional intro of 2 to 4 sentences.",
        "Create 6 to 9 sections with useful headings and complete guidance.",
        "Cover relevant areas such as welcome, how we work, communication, timeline, feedback process, client responsibilities, payments, files/deliverables, approvals, and next steps.",
        "Each section body should be practical and specific: usually 2 to 5 sentences.",
        "Use clear client-facing language. Avoid generic filler, placeholders, or internal notes.",
        "Set acknowledgementRequired true when the document includes expectations, approvals, process rules, or client responsibilities.",
      ].join(" ");
    default:
      return "Draft concise, practical structured data for this operational workflow.";
  }
}

function schemaFor(workflow: OperationsWorkflow) {
  switch (workflow) {
    case "client":
      return aiClientDraftSchema;
    case "project":
      return aiProjectDraftSchema;
    case "portal":
      return aiPortalDraftSchema;
    case "time_entry":
      return aiTimeEntryDraftSchema;
    case "contract":
      return aiContractDraftSchema;
    case "welcome_document":
      return aiWelcomeDraftSchema;
  }
}

export async function draftOperationalWorkflow(
  workflow: OperationsWorkflow,
  ctx: DraftContext,
): Promise<{ draft: OperationsDraft; provider: "groq" | "local" }> {
  const fallback = localDraft(workflow, ctx);
  const aiJson = await generateStructuredJson({
    operation: `workflow_draft.${workflow}`,
    messages: [
      {
        role: "system",
        content: [
          "You draft structured Stackivo workflow data for freelancers and agencies.",
          "Return only JSON. Never execute actions, mutate databases, calculate taxes, send messages, or invent private data.",
          "Prefer concise, practical business wording. Use only provided client and project ids.",
          workflowInstructions(workflow),
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          workflow,
          prompt: ctx.prompt,
          selectedClientId: ctx.clientId,
          selectedProjectId: ctx.projectId,
          clients: ctx.clients.map((client) => ({
            id: client.id,
            name: getClientDisplayName(client),
            businessName: client.businessName,
            email: client.email,
            country: client.country,
            currency: client.currency,
            isForeign: client.isForeign,
          })),
          projects: ctx.projects.map((project) => ({
            id: project.id,
            name: project.name,
            clientId: project.clientId,
            description: project.description,
          })),
          today: today(),
          defaultHourlyRate: ctx.defaultHourlyRate ?? 0,
          fallback,
        }),
      },
    ],
  }).catch(() => null);

  const parsed = schemaFor(workflow).safeParse(aiJson);
  if (!parsed.success) return { draft: fallback, provider: "local" };
  return { draft: parsed.data as OperationsDraft, provider: "groq" };
}
