import type { ReactNode } from "react";

/**
 * Shared types for the Stackivo AI assistant. Extracted from the main
 * component so the helpers, preview sub-components, and the panel itself all
 * reference one source of truth.
 */

export interface AiEntityOption {
  id: string;
  name: string;
  clientId?: string | null;
  currency?: string | null;
  isForeign?: boolean | null;
  country?: string | null;
}

export interface StackivoAiAssistantProps {
  clients: AiEntityOption[];
  projects: AiEntityOption[];
  user?: {
    name?: string | null;
    businessName?: string | null;
  };
}

export type AiMode =
  | "general"
  | "invoice"
  | "contract"
  | "welcome_document"
  | "client"
  | "project"
  | "time_entry"
  | "support";

export interface Message {
  id: string;
  role: "assistant" | "user";
  content: ReactNode;
  /** Optional one-tap quick replies shown under an assistant message. */
  suggestions?: string[];
  /** Optional short professional tip shown under an assistant message. */
  tip?: string;
}

export interface AiInvoicePreview {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  originalSubtotal: number;
  discount: number;
  subtotal: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  taxTotal: number;
  taxMode?: "non_gst" | "cgst_sgst" | "igst";
  totalAmount: number;
  currency: string;
  dueDate: string;
  status: string;
  terms: string | null;
  notes: string | null;
  /** True when the client is foreign — an export invoice (zero-rated / LUT). */
  isExport?: boolean;
}

export interface AiContractPreview {
  id: string;
  title: string;
  kind: "contract" | "proposal";
  clientName: string;
  clientEmail: string | null;
  projectName: string | null;
  valueAmount: number | null;
  currency: string;
  sections: Array<{ heading: string; body: string }>;
  /** True when the client is foreign — cross-border contract. */
  isInternational?: boolean;
}

export interface AiWelcomeDocPreview {
  id: string;
  title: string;
  intro: string | null;
  sections: Array<{ heading: string; body: string }>;
  acknowledgementRequired: boolean;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  projectName: string | null;
}

export interface AiConfirmSummary {
  kind: "client" | "project" | "time_entry";
  title: string;
  lines: Array<[label: string, value: string]>;
}

export interface AiInvoiceListRow {
  id: string;
  invoiceNumber: string;
  clientName: string;
  totalAmount: number;
  currency: string;
  status: string;
  dueDate: string | null;
}

export interface AiContractListRow {
  id: string;
  title: string;
  kind: "contract" | "proposal";
  clientName: string;
  status: string;
}

export interface AiClientListRow {
  id: string;
  name: string;
}

export interface AiProjectListRow {
  id: string;
  name: string;
  clientName: string;
  status: string;
  dueDate: string | null;
}

export interface AiWelcomeDocListRow {
  id: string;
  title: string;
  clientName: string;
  status: string;
  views: number;
  acknowledgements: number;
  sentAt: string | null;
}
