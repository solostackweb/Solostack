import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { getUserPaymentMethodSummary } from "@/features/billing/payment-methods";
import { PaymentMethodPicker } from "@/features/billing/components/payment-method-picker";
import { SettingsPageHeader } from "@/features/settings/components/settings-section";
import { listMyConnections } from "@/features/payments/connections";
import { PaymentConnectionsCard } from "@/features/payments/components/payment-connections-card";

export const metadata = {
  title: "Payments - Stackivo",
  description:
    "Set up domestic UPI payments and international payment connections.",
};

export default async function PaymentsSettingsPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);

  const [summary, connections] = await Promise.all([
    getUserPaymentMethodSummary(user.id),
    listMyConnections(),
  ]);

  // Surface legacy hint if user previously had the old key-paste model.
  let showLegacyHint = false;
  const admin = getAdminSupabase();
  const { data: legacy } = await admin
    .from("user_profiles")
    .select("razorpay_account_status")
    .eq("id", user.id)
    .maybeSingle();
  if (
    !summary.type &&
    (legacy as { razorpay_account_status?: string } | null)
      ?.razorpay_account_status === "connected"
  ) {
    showLegacyHint = true;
  }

  return (
    <>
      <SettingsPageHeader
        title="Payments"
        description="Set up how clients pay you. Indian invoices use UPI; export invoices use your international payment methods."
      />

      <div className="space-y-5">
        {showLegacyHint && (
          <div className="rounded-lg border border-warning-subtle bg-warning/[0.04] p-4 text-xs leading-relaxed text-warning-strong">
            <p className="font-semibold">We&apos;ve upgraded the payments experience.</p>
            <p className="mt-1">
              The old &quot;paste your Razorpay key&quot; flow is retired. Set up
              UPI for Indian clients and use payment connections for
              international clients.
            </p>
          </div>
        )}

        <PaymentMethodPicker
          summary={summary}
          initialUpiVpa={null}
        />

        <PaymentConnectionsCard connections={connections} />
      </div>
    </>
  );
}
