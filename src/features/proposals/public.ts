import "server-only";

import { getAdminSupabase } from "@/lib/supabase/admin";
import type {
  ClientRow,
  ProposalItemRow,
  ProposalRow,
  ProjectRow,
  UserProfileRow,
} from "@/lib/supabase/types";
import { createSignedStorageUrl } from "@/features/profile/storage";
import { isValidPublicShareToken } from "@/features/share/server";

export interface PublicProposalData {
  proposal: ProposalRow;
  items: ProposalItemRow[];
  seller: UserProfileRow | null;
  client: ClientRow | null;
  project: ProjectRow | null;
  logoUrl: string | null;
}

export async function getPublicProposal(
  token: string,
): Promise<PublicProposalData | null> {
  if (!isValidPublicShareToken(token)) return null;
  const admin = getAdminSupabase();
  const { data: proposalData } = await admin
    .from("proposals")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  if (!proposalData) return null;

  const proposal = proposalData as unknown as ProposalRow;
  const [{ data: items }, { data: seller }, { data: client }, { data: project }] =
    await Promise.all([
      admin
        .from("proposal_items")
        .select("*")
        .eq("proposal_id", proposal.id)
        .order("sort_order", { ascending: true }),
      admin
        .from("user_profiles")
        .select("*")
        .eq("id", proposal.user_id)
        .maybeSingle(),
      proposal.client_id
        ? admin.from("clients").select("*").eq("id", proposal.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
      proposal.project_id
        ? admin.from("projects").select("*").eq("id", proposal.project_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const sellerRow = (seller as unknown as UserProfileRow | null) ?? null;
  const logoUrl =
    (await createSignedStorageUrl("branding-assets", sellerRow?.logo_url, admin)) ??
    (await createSignedStorageUrl("branding-assets", sellerRow?.brand_icon_url, admin));

  return {
    proposal,
    items: ((items as unknown as ProposalItemRow[]) ?? []),
    seller: sellerRow,
    client: (client as unknown as ClientRow | null) ?? null,
    project: (project as unknown as ProjectRow | null) ?? null,
    logoUrl,
  };
}

export async function recordProposalView(token: string): Promise<void> {
  if (!isValidPublicShareToken(token)) return;
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("proposals")
    .select("id, user_id, title, status, viewed_at")
    .eq("public_token", token)
    .maybeSingle();
  if (!data) return;
  const proposal = data as {
    id: string;
    user_id: string;
    title: string;
    status: string;
    viewed_at: string | null;
  };
  if (
    proposal.viewed_at &&
    Date.now() - new Date(proposal.viewed_at).getTime() < 60 * 60 * 1000
  ) {
    return;
  }

  const patch: Record<string, unknown> = {
    viewed_at: new Date().toISOString(),
  };
  if (proposal.status === "sent") patch.status = "viewed";
  await admin.from("proposals").update(patch as never).eq("id", proposal.id);

  await admin.from("activity_events").insert({
    user_id: proposal.user_id,
    kind: "proposal_viewed",
    entity_type: "proposal",
    entity_id: proposal.id,
    title: `"${proposal.title}" viewed`,
    metadata: { via: "public_link" },
  } as never);

  await admin.from("notifications").insert({
    user_id: proposal.user_id,
    type: "proposal_viewed",
    title: `"${proposal.title}" viewed`,
    message: "Your client just opened this proposal.",
  } as never);
}
