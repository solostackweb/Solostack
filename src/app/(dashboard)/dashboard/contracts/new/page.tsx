import { ContractBuilderView } from "@/features/contracts/components/contract-builder-view";
import { listClients } from "@/features/clients/server";
import { listProjects } from "@/features/projects/server";
import { getProfile } from "@/features/profile/server";
import { hasFreelancerSignature } from "@/features/profile/signature";
import { SignatureRequiredGate } from "@/features/profile/components/signature-required-gate";
import { listTemplates } from "@/features/templates/server";

export const metadata = { title: "New contract" };
export const dynamic = "force-dynamic";

export default async function NewContractPage() {
  const [clients, projects, profile, templates] = await Promise.all([
    listClients({ limit: 200 }),
    listProjects({ limit: 200 }),
    getProfile(),
    listTemplates("contract"),
  ]);

  if (!hasFreelancerSignature(profile)) {
    return (
      <SignatureRequiredGate
        title="Add your signature first"
        description="Stackivo needs your freelancer signature before you can create or send contracts. This keeps your documents consistent and ready for signing."
        ctaLabel="Set up signature"
      />
    );
  }

  return <ContractBuilderView clients={clients} projects={projects} templates={templates} />;
}
