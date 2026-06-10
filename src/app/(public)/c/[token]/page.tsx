import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PublicDocumentFrame } from "@/features/share/components/public-document-frame";
import { ContractPublicView } from "@/features/share/components/contract-public-view";
import { ContractSigningPanel } from "@/features/share/components/contract-signing-panel";
import {
  getSharedContract,
  recordContractView,
} from "@/features/share/server";
import { buildContractPdfDataByToken } from "@/features/documents/builders";
import { getContractPdfShareUrl } from "@/features/documents/urls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const data = await buildContractPdfDataByToken(token);
  if (!data) return { title: "Document not found" };
  return {
    title: `${data.kind === "proposal" ? "Proposal" : "Contract"} — ${data.title}`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicContractPage({ params }: Props) {
  const { token } = await params;
  const [shared, viewModel] = await Promise.all([
    getSharedContract(token),
    buildContractPdfDataByToken(token),
  ]);
  if (!shared || !viewModel) notFound();

  void recordContractView(token);

  const status = shared.status;
  const tone =
    status === "signed"
      ? "bg-success/10 text-success"
      : status === "declined"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";
  const eyebrow = viewModel.kind === "proposal" ? "Proposal" : "Contract";
  const slug = viewModel.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return (
    <PublicDocumentFrame
      eyebrow={eyebrow}
      title={viewModel.title}
      subtitle={`From ${viewModel.seller.businessName}`}
      senderName={viewModel.seller.businessName}
      logoUrl={viewModel.seller.logoDataUrl}
      accent={viewModel.brandColor}
      statusBadge={
        <Badge
          variant="secondary"
          className={`h-5 px-1.5 text-[10px] capitalize ${tone}`}
        >
          {status}
        </Badge>
      }
      pdfUrl={getContractPdfShareUrl(token)}
      pdfFileName={`${viewModel.kind}-${slug || viewModel.kind}.pdf`}
    >
      <div className="space-y-6">
        <ContractPublicView data={viewModel} />
        <ContractSigningPanel
          token={token}
          signed={status === "signed"}
          contractTitle={viewModel.title}
        />
      </div>
    </PublicDocumentFrame>
  );
}
