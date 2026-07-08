"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  Users,
  Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import {
  AiWorkflowTriggerButton,
  OperationalAiAgentWorkflow,
} from "@/features/ai-workflows/components/operational-ai-agent-workflow";
import type { AiPortalDraft } from "@/features/ai-workflows/types";
import { portalDashboardDetail } from "../routes";
import { CreatePortalButton } from "./create-portal-button";

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
  const [aiOpen, setAiOpen] = React.useState(false);
  const [aiDraft, setAiDraft] = React.useState<AiPortalDraft | null>(null);

  const clientOptions = React.useMemo(
    () =>
      clients.map((client) => ({
        id: client.id,
        name: client.businessName
          ? `${client.businessName} - ${client.fullName}`
          : client.fullName,
      })),
    [clients],
  );
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
          <div className="flex items-center gap-2">
            <AiWorkflowTriggerButton
              active={aiOpen}
              onClick={() => setAiOpen((value) => !value)}
            >
              Generate portal with AI
            </AiWorkflowTriggerButton>
            <CreatePortalButton
              clients={clients}
              activeClientIds={activeClientIds}
              initialAiDraft={aiDraft}
            />
          </div>
        }
      />

      <div
        className={cn(
          "grid items-start gap-6",
          aiOpen ? "xl:grid-cols-[minmax(0,1fr)_420px]" : "grid-cols-1",
        )}
      >
        <div className="min-w-0">
          {ownedPortals.length === 0 ? (
            <EmptyState
              icon={Workflow}
              title="No portals yet"
              description="Create a portal to share files, contracts, and invoices with a client in one branded space."
            />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <PortalStat
                  icon={LayoutDashboard}
                  label="Portals"
                  value={String(ownedPortals.length)}
                />
                <PortalStat
                  icon={CheckCircle2}
                  label="Active"
                  value={String(activePortals)}
                />
                <PortalStat
                  icon={Users}
                  label="Clients linked"
                  value={String(activeClientIds.length)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ownedPortals.map((portal) => {
                  const client = portal.client_id
                    ? clientMap.get(portal.client_id)
                    : null;
                  const clientName =
                    client?.businessName || client?.fullName || "No client linked";
                  const color = portal.brand_color ?? "#2563EB";
                  return (
                    <Link
                      key={portal.id}
                      href={portalDashboardDetail(portal.id)}
                      className="group"
                    >
                      <Card className="h-full overflow-hidden border-border/70 transition-colors hover:border-primary/40">
                        <CardContent className="p-0">
                          <div className="h-1.5" style={{ background: color }} />
                          <div className="space-y-4 p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
                                style={{ background: color }}
                                aria-hidden
                              >
                                {portal.name.slice(0, 2).toUpperCase()}
                              </div>
                              <Badge variant="outline" className="capitalize text-[10px]">
                                {portal.status}
                              </Badge>
                            </div>
                            <div className="min-w-0">
                              <p className="line-clamp-2 text-sm font-semibold leading-snug">
                                {portal.name}
                              </p>
                              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <Users className="h-3.5 w-3.5" />
                                <span className="truncate">{clientName}</span>
                              </p>
                            </div>
                            <div className="flex items-center justify-between gap-3 border-t pt-3">
                              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Clock3 className="h-3.5 w-3.5" />
                                Updated {new Date(portal.updated_at).toLocaleDateString()}
                              </p>
                              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <OperationalAiAgentWorkflow<AiPortalDraft>
          workflow="portal"
          title="Create portal"
          intro="let's create a client portal. I will pick up the client context, draft the portal name and brand setup, then open the portal form for review."
          clients={clientOptions}
          open={aiOpen}
          onOpenChange={setAiOpen}
          applyLabel="Review portal setup"
          onApplyDraft={(draft) => setAiDraft(draft)}
        />
      </div>
    </div>
  );
}

function PortalStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}
