import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { StackivoGrowthCta } from "@/components/marketing/stackivo-growth-cta";
import { ownerHasCustomBranding } from "@/features/billing/branding-check";
import { getProposalPdfShareUrl } from "@/features/documents/urls";
import { ProposalPublicView } from "@/features/proposals/components/proposal-public-view";
import { getPublicProposal, recordProposalView } from "@/features/proposals/public";
import { PublicDocumentFrame } from "@/features/share/components/public-document-frame";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const data = await getPublicProposal(token);
  if (!data) return { title: "Proposal not found" };
  return {
    title: `Proposal - ${data.proposal.title}`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicProposalPage({ params }: Props) {
  const { token } = await params;
  const data = await getPublicProposal(token);
  if (!data) notFound();

  void recordProposalView(token);

  const sellerName =
    data.seller?.business_name ||
    data.seller?.company_name ||
    data.seller?.full_name ||
    "Freelancer";
  const isBranded = await ownerHasCustomBranding(data.proposal.user_id);

  return (
    <PublicDocumentFrame
      eyebrow="Proposal"
      title={data.proposal.title}
      subtitle={`From ${sellerName}`}
      senderName={sellerName}
      logoUrl={data.logoUrl}
      accent={data.seller?.brand_color}
      statusBadge={
        <Badge variant="secondary" className="h-5 px-1.5 text-xs capitalize">
          {data.proposal.status}
        </Badge>
      }
    >
      <div className="space-y-6">
        <ProposalPublicView data={data} pdfUrl={getProposalPdfShareUrl(token)} />
        {!isBranded ? <StackivoGrowthCta kind="proposal" /> : null}
      </div>
    </PublicDocumentFrame>
  );
}
