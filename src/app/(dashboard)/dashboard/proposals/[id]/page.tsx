import { notFound } from "next/navigation";

import { listClients } from "@/features/clients/server";
import { listProjects } from "@/features/projects/server";
import { ProposalBuilderView } from "@/features/proposals/components/proposal-builder-view";
import { getProposalWithItems } from "@/features/proposals/server";
import { getServerSupabase } from "@/lib/supabase/server";
import type { UserProfileRow } from "@/lib/supabase/types";

export const metadata = {
  title: "Proposal Builder | Stackivo",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProposalBuilderPage({ params }: Props) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [record, clients, projects] = await Promise.all([
    getProposalWithItems(id),
    listClients({ limit: 300 }),
    listProjects({ limit: 300 }),
  ]);
  if (!record) notFound();
  const { data: profile } = user
    ? await supabase
        .from("user_profiles")
        .select("gst_registered, state_code, invoice_default_gst_rate, lut_number")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
  const seller = profile as Pick<
    UserProfileRow,
    "gst_registered" | "state_code" | "invoice_default_gst_rate" | "lut_number"
  > | null;

  return (
    <ProposalBuilderView
      proposal={record.proposal}
      items={record.items}
      seller={{
        gstRegistered: seller?.gst_registered ?? false,
        stateCode: seller?.state_code ?? null,
        defaultGstRate: seller?.invoice_default_gst_rate ?? 18,
        lutNumber: seller?.lut_number ?? null,
      }}
      clients={clients.map((client) => ({
        id: client.id,
        name: client.businessName || client.fullName,
        email: client.email,
        country: client.country,
        currency: client.currency,
        isForeign: client.isForeign,
        gstRegistered: client.gstRegistered,
        stateCode: client.stateCode,
      }))}
      projects={projects.map((project) => ({
        id: project.id,
        name: project.name,
        clientId: project.clientId,
      }))}
    />
  );
}
