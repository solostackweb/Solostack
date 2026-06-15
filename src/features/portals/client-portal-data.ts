import "server-only";

import { notFound } from "next/navigation";
import { isR2Configured } from "@/lib/r2/client";
import {
  PortalAccessError,
  getPortalSnapshot,
} from "@/features/portals/server";
import type { ViewProps } from "./components/portal-view";

export async function getClientPortalProps(portalId: string): Promise<ViewProps> {
  let snapshot;
  try {
    snapshot = await getPortalSnapshot(portalId);
  } catch (err) {
    if (err instanceof PortalAccessError) notFound();
    throw err;
  }

  const { access } = snapshot;

  return {
    portalId,
    portalName: access.portal.name,
    brandColor: access.portal.brand_color ?? "#2563EB",
    portalStatus: access.portal.status,
    currentUserId: access.userId,
    role: access.role,
    clientId: snapshot.client?.id ?? access.portal.client_id,
    clientName:
      snapshot.client?.fullName ??
      snapshot.client?.businessName ??
      access.portal.name,
    clientEmail: snapshot.client?.email ?? null,
    members: snapshot.members.map((m) => ({
      user_id: m.user_id,
      role: m.role,
      profile: m.profile,
    })),
    pendingInvitations: access.role === "owner" ? snapshot.pendingInvitations : [],
    files: snapshot.files,
    messages: snapshot.messages,
    contracts: snapshot.contracts,
    availableContracts: access.role === "owner" ? snapshot.availableContracts : [],
    invoices: snapshot.invoices,
    availableInvoices: access.role === "owner" ? snapshot.availableInvoices : [],
    welcomeDocuments: snapshot.welcomeDocuments,
    availableWelcomeDocuments:
      access.role === "owner" ? snapshot.availableWelcomeDocuments : [],
    activity: snapshot.activity,
    updates: snapshot.updates,
    meetings: snapshot.meetings,
    timeByProject: snapshot.timeByProject,
    storageUsage: snapshot.storageUsage,
    storageCap: Number.POSITIVE_INFINITY,
    r2Enabled: isR2Configured(),
  };
}
