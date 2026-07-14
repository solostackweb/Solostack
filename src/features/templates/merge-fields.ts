/**
 * Template merge fields.
 *
 * Templates can embed `{{variable}}` tokens that get auto-filled from the
 * chosen client / project / freelancer profile *at the moment a document is
 * started from the template*. Substitution happens at create-time (not stored
 * resolved) so the same template stays reusable for every client.
 *
 * Unknown / unresolved tokens are left intact (visible) so the freelancer
 * notices and can fill them in the builder.
 */

export interface MergeVariable {
  /** Token key, used as `{{key}}`. */
  key: string;
  label: string;
  /** Example value, shown in the editor helper. */
  sample: string;
}

/** The variables a template can reference. Order = display order in the editor. */
export const MERGE_VARIABLES: readonly MergeVariable[] = [
  { key: "client_name", label: "Client name", sample: "Priya Sharma" },
  { key: "client_company", label: "Client company", sample: "Acme Studio" },
  { key: "client_email", label: "Client email", sample: "priya@acme.com" },
  { key: "project_name", label: "Project name", sample: "Website redesign" },
  { key: "business_name", label: "Your business", sample: "Your Studio" },
  { key: "freelancer_name", label: "Your name", sample: "Alex" },
  { key: "currency", label: "Currency", sample: "INR" },
  { key: "today", label: "Today's date", sample: "14 Jul 2026" },
];

export type MergeContext = Record<string, string>;

/** Build the substitution map from whatever context is available. */
export function resolveMergeContext(input: {
  client?: {
    fullName?: string | null;
    businessName?: string | null;
    email?: string | null;
  } | null;
  project?: { name?: string | null } | null;
  seller?: {
    businessName?: string | null;
    companyName?: string | null;
    fullName?: string | null;
  } | null;
  currency?: string | null;
}): MergeContext {
  const client = input.client ?? null;
  const seller = input.seller ?? null;
  return {
    client_name: client?.fullName || client?.businessName || "",
    client_company: client?.businessName || "",
    client_email: client?.email || "",
    project_name: input.project?.name || "",
    business_name:
      seller?.businessName || seller?.companyName || seller?.fullName || "",
    freelancer_name: seller?.fullName || "",
    currency: input.currency || "",
    today: new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  };
}

const MERGE_TOKEN_RE = /\{\{\s*([a-z_]+)\s*\}\}/gi;

/** Replace `{{key}}` tokens in a string; leave unresolved tokens intact. */
export function applyMergeFields(text: string, ctx: MergeContext): string {
  return text.replace(MERGE_TOKEN_RE, (match, rawKey) => {
    const value = ctx[String(rawKey).toLowerCase()];
    return value ? value : match;
  });
}

/** Deep-apply merge fields to every string inside a template content object. */
export function applyMergeFieldsDeep<T>(value: T, ctx: MergeContext): T {
  if (typeof value === "string") {
    return applyMergeFields(value, ctx) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyMergeFieldsDeep(item, ctx)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = applyMergeFieldsDeep(v, ctx);
    }
    return out as T;
  }
  return value;
}
