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
  kind?: "invoice" | "contract";
}) {
  const label =
    kind === "contract"
      ? "Want to send contracts like this?"
      : "Want to send invoices like this?";
  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
      <span className="font-medium text-slate-700">{label}</span>{" "}
      Create GST invoices, contracts &amp; get paid faster —{" "}
      <Link
        href="/?utm_source=public_doc&utm_medium=viral&utm_campaign=sent_via"
        className="font-semibold text-slate-900 underline underline-offset-2 hover:opacity-80"
      >
        try Stackivo free
      </Link>
      .
    </div>
  );
}
