import Link from "next/link";

/**
 * Viral growth CTA shown on FREE-plan public documents (invoice / contract).
 * Implements the playbook's "get paid to advertise" mechanic: every document a
 * free user shares becomes an acquisition surface. Paid users (custom branding)
 * never see this — callers gate on `ownerHasCustomBranding`.
 */
export function StackivoGrowthCta({
  kind = "invoice",
}: {
  kind?: "invoice" | "contract" | "proposal";
}) {
  const label =
    kind === "proposal"
      ? "Want to send proposals like this?"
      : kind === "contract"
      ? "Want to send contracts like this?"
      : "Want to send invoices like this?";
  return (
    <div className="mt-6 rounded-lg border border-border bg-muted px-4 py-3 text-center text-xs text-muted-foreground">
      <span className="font-medium text-muted-foreground">{label}</span>{" "}
      Create GST invoices, contracts &amp; get paid faster —{" "}
      <Link
        href="/?utm_source=public_doc&utm_medium=viral&utm_campaign=sent_via"
        className="font-semibold text-foreground underline underline-offset-2 hover:opacity-80"
      >
        try Stackivo free
      </Link>
      .
    </div>
  );
}
