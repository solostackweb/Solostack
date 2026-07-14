import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";
import { resolveMergeContext, type MergeContext } from "./merge-fields";

/**
 * Server helper: resolve the merge-field substitution map for a user from a
 * chosen client / project (both optional) plus their own profile. Shared by
 * the proposal, contract, and welcome-doc create-from-template flows so the
 * lookup logic lives in exactly one place.
 */
export async function resolveMergeContextForUser(input: {
  userId: string;
  clientId?: string | null;
  projectId?: string | null;
  currency?: string | null;
}): Promise<MergeContext> {
  const supabase = await getServerSupabase();
  const [clientRes, projectRes, profileRes] = await Promise.all([
    input.clientId
      ? supabase
          .from("clients")
          .select("full_name,business_name,email")
          .eq("id", input.clientId)
          .eq("user_id", input.userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    input.projectId
      ? supabase
          .from("projects")
          .select("name")
          .eq("id", input.projectId)
          .eq("user_id", input.userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("user_profiles")
      .select("business_name,company_name,full_name")
      .eq("id", input.userId)
      .maybeSingle(),
  ]);

  const client = clientRes.data as {
    full_name?: string | null;
    business_name?: string | null;
    email?: string | null;
  } | null;
  const project = projectRes.data as { name?: string | null } | null;
  const seller = profileRes.data as {
    business_name?: string | null;
    company_name?: string | null;
    full_name?: string | null;
  } | null;

  return resolveMergeContext({
    client: client
      ? {
          fullName: client.full_name,
          businessName: client.business_name,
          email: client.email,
        }
      : null,
    project: project ? { name: project.name } : null,
    seller: seller
      ? {
          businessName: seller.business_name,
          companyName: seller.company_name,
          fullName: seller.full_name,
        }
      : null,
    currency: input.currency ?? null,
  });
}
