import { decideTax } from "@/features/gst/decision";

export interface ProposalSellerContext {
  gstRegistered: boolean;
  stateCode: string | null;
  defaultGstRate: number;
  lutNumber: string | null;
}

export interface ProposalClientContext {
  id: string;
  country: string;
  currency: string;
  isForeign: boolean;
  gstRegistered: boolean;
  stateCode: string | null;
}

export interface ProposalBillingGuidance {
  currency: string;
  recommendedTaxRate: number;
  modeLabel: string;
  badge: string;
  summary: string;
  detail: string;
  publicNote: string;
}

export function getProposalBillingGuidance(input: {
  seller: ProposalSellerContext;
  client: ProposalClientContext | null;
  fallbackCurrency?: string;
}): ProposalBillingGuidance {
  const fallbackCurrency = input.fallbackCurrency || "INR";
  if (!input.client) {
    return {
      currency: fallbackCurrency,
      recommendedTaxRate: input.seller.gstRegistered ? input.seller.defaultGstRate : 0,
      modeLabel: "Client needed",
      badge: "Draft",
      summary: "Choose a client to lock currency and tax treatment.",
      detail:
        "Stackivo will use the client's country, currency, GST registration, and state to guide proposal pricing.",
      publicNote: "Tax and billing treatment will be confirmed before invoicing.",
    };
  }

  if (input.client.isForeign || input.client.country !== "IN") {
    return {
      currency: input.client.currency || fallbackCurrency || "USD",
      recommendedTaxRate: 0,
      modeLabel: "Export services",
      badge: "Export",
      summary: `Quote this proposal in ${input.client.currency || fallbackCurrency}.`,
      detail: input.seller.lutNumber
        ? "International client detected. Proposal pricing is shown without GST; invoice conversion will use export/zero-rated treatment under LUT."
        : "International client detected. Proposal pricing is shown without GST; add LUT details in settings if you issue zero-rated export invoices.",
      publicNote:
        "This is an international proposal. Taxes, if any, will be handled according to the final invoice and applicable export rules.",
    };
  }

  if (!input.seller.gstRegistered) {
    return {
      currency: "INR",
      recommendedTaxRate: 0,
      modeLabel: "Non-GST",
      badge: "Domestic",
      summary: "Domestic Indian client. Seller is not GST registered.",
      detail:
        "Proposal pricing should be shown without GST. If you register for GST later, update your business settings before invoicing.",
      publicNote:
        "GST is not included in this proposal because the supplier is not GST registered.",
    };
  }

  const decision = decideTax({
    seller: input.seller,
    client: input.client,
  });

  return {
    currency: "INR",
    recommendedTaxRate: input.seller.defaultGstRate,
    modeLabel: decision.mode === "cgst_sgst" ? "Intra-state GST" : "Inter-state GST",
    badge: decision.classification.toUpperCase(),
    summary:
      decision.mode === "cgst_sgst"
        ? "Domestic client in the same state. Invoice conversion will apply CGST + SGST."
        : "Domestic client in a different or unknown state. Invoice conversion will apply IGST.",
    detail:
      decision.mode === "cgst_sgst"
        ? "State codes match, so Stackivo treats this as intra-state supply for invoice conversion."
        : "State codes differ or are incomplete, so Stackivo treats this as inter-state supply for invoice conversion.",
    publicNote:
      decision.mode === "cgst_sgst"
        ? "Applicable GST may be charged as CGST and SGST on the final invoice."
        : "Applicable GST may be charged as IGST on the final invoice.",
  };
}
