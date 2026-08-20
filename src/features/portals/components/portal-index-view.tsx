"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Clock3,
  FileCheck2,
  MessageSquareText,
  Users,
  Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import { IvoContextActions } from "@/features/ai-workflows/components/ivo-context-actions";
import { portalDashboardDetail } from "../routes";
import { CreatePortalButton } from "./create-portal-button";
import { BRAND_PRIMARY } from "@/config/brand-colors";

interface PortalIndexViewProps {
  ownedPortals: Array<{
    id: string;
    name: string;
    status: string;
    client_id: string | null;
    brand_color: string | null;
    updated_at: string;
  }>;
  clients: Array<{
    id: string;
    fullName: string;
    businessName: string | null;
    email: string | null;
  }>;
  activeClientIds: string[];
}

export function PortalIndexView({
  ownedPortals,
  clients,
  activeClientIds,
}: PortalIndexViewProps) {

  const activePortals = ownedPortals.filter((portal) => portal.status === "active").length;
  const clientMap = React.useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client portals"
        description="Branded shared workspaces for your clients."
        actions={
          ownedPortals.length > 0 ? (
            <CreatePortalButton
              clients={clients}
              activeClientIds={activeClientIds}
              initialAiDraft={null}
            />
          ) : null
        }
      />

      <div className={cn("grid items-start gap-6", "grid-cols-1")}>
        <div className="min-w-0">
          {ownedPortals.length === 0 ? (
            <div className="overflow-hidden rounded-2xl border bg-card">
              <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,0.85fr)_minmax(420px,1.15fr)] lg:items-center lg:p-9">
                <div className="max-w-xl">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                    <Workflow className="h-5 w-5" />
                  </span>
                  <p className="mt-5 text-sm font-semibold text-primary">Your client handoff, in one place</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                    Give every client a clear place to follow the work.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
                    Choose a client, confirm what they can see, then share one branded workspace for documents, invoices, files, and updates.
                  </p>
                  <div className="mt-6">
                    <CreatePortalButton
                      clients={clients}
                      activeClientIds={activeClientIds}
                      initialAiDraft={null}
                    />
                  </div>
                </div>

                <ol className="relative grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <PortalStep
                    number="01"
                    icon={Users}
                    title="Choose the client"
                    description="Start from an existing client so access stays connected to the right work."
                  />
                  <PortalStep
                    number="02"
                    icon={FileCheck2}
                    title="Review what is shared"
                    description="Confirm the documents, invoices, files, and meetings they should see."
                  />
                  <PortalStep
                    number="03"
                    icon={MessageSquareText}
                    title="Invite and stay aligned"
                    description="Send one link and keep the handoff, activity, and updates together."
                  />
                </ol>
              </div>
              <div className="border-t bg-muted/20 px-5 py-4 sm:px-7 lg:px-9">
                <IvoContextActions
                  title="Need help choosing the right handoff?"
                  description="Ivo can review your clients or prepare a portal checklist."
                  actions={[
                    {
                      label: "Who needs a portal?",
                      prompt: `Compare my ${clients.length} clients with my ${ownedPortals.length} existing portals (${activePortals} active). Review each client's active projects and shared work, then recommend who should get a portal next and explain why.`,
                    },
                    {
                      label: "Prepare a checklist",
                      prompt: "Give me a professional checklist for setting up a client portal: invoices, contracts, welcome docs, files, meetings, and client access.",
                    },
                  ]}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <IvoContextActions
                title="Portal planning"
                description="Review the next client handoff or prepare a sharing checklist."
                actions={[
                  {
                    label: "Who needs a portal?",
                    prompt: `Compare my ${clients.length} clients with my ${ownedPortals.length} existing portals (${activePortals} active). Review each client's active projects and shared work, then recommend who should get a portal next and explain why.`,
                  },
                  {
                    label: "Portal checklist",
                    prompt: "Give me a professional checklist for setting up a client portal: invoices, contracts, welcome docs, files, meetings, and client access.",
                  },
                ]}
              />
              <div className="grid grid-cols-3 overflow-hidden rounded-lg border bg-card">
                <PortalStat label="Portals" value={String(ownedPortals.length)} />
                <PortalStat label="Active" value={String(activePortals)} divided />
                <PortalStat label="Clients" value={String(activeClientIds.length)} divided />
              </div>

              <div className="divide-y overflow-hidden rounded-lg border bg-card">
                {ownedPortals.map((portal) => {
                  const client = portal.client_id
                    ? clientMap.get(portal.client_id)
                    : null;
                  const clientName =
                    client?.businessName || client?.fullName || "No client linked";
                  const color = portal.brand_color ?? BRAND_PRIMARY;
                  return (
                    <Link
                      key={portal.id}
                      href={portalDashboardDetail(portal.id)}
                      className="group flex min-w-0 items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/20 sm:px-5"
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ background: color }}
                        aria-hidden
                      >
                        {portal.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{portal.name}</p>
                        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{clientName}</span>
                          <span aria-hidden>·</span>
                          <Clock3 className="h-3.5 w-3.5 shrink-0" />
                          <span className="shrink-0">
                            {new Date(portal.updated_at).toLocaleDateString()}
                          </span>
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 capitalize text-xs">
                        {portal.status}
                      </Badge>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function PortalStep({
  number,
  icon: Icon,
  title,
  description,
}: {
  number: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <li className="flex gap-3 rounded-lg border bg-background/80 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold">{title}</p>
          <span className="font-mono text-xs text-muted-foreground">{number}</span>
        </div>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
    </li>
  );
}

function PortalStat({
  label,
  value,
  divided = false,
}: {
  label: string;
  value: string;
  divided?: boolean;
}) {
  return (
    <div className={cn("min-w-0 p-4", divided && "border-l")}>
      <p className="truncate text-micro font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
