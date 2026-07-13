import "server-only";

import { notFound } from "next/navigation";
import { isR2Configured } from "@/lib/r2/client";
import { PORTAL_STORAGE_CAP_BYTES } from "@/features/portals/storage";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { createSignedStorageUrl } from "@/features/profile/storage";
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

  // Current member's previous visit time (for "what's new since last visit").
  const { data: memberRow } = await getAdminSupabase()
    .from("portal_members")
    .select("last_seen_at")
    .eq("portal_id", portalId)
    .eq("user_id", access.userId)
    .maybeSingle();
  const lastSeenAt = (memberRow as { last_seen_at: string | null } | null)?.last_seen_at ?? null;

  // Freelancer's brand logo (set once in Branding settings) — signed via the
  // admin client so the client viewer can display it without storage-RLS issues.
  const admin = getAdminSupabase();
  const { data: ownerProfile } = await admin
    .from("user_profiles")
    .select("logo_url")
    .eq("id", access.portal.owner_user_id)
    .maybeSingle();
  const logoPath = (ownerProfile as { logo_url: string | null } | null)?.logo_url ?? null;
  const brandLogoUrl = await createSignedStorageUrl("branding-assets", logoPath, admin);

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
    proposals: snapshot.proposals,
    availableProposals: access.role === "owner" ? snapshot.availableProposals : [],
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
    storageCap: PORTAL_STORAGE_CAP_BYTES,
    r2Enabled: isR2Configured(),
    lastSeenAt,
    welcomeVideoUrl: access.portal.welcome_video_url ?? null,
    welcomeMessage: access.portal.welcome_message ?? null,
    brandLogoUrl,
  };
}
