import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import {
  getUserPaymentMethod,
  getUserPaymentMethodSummary,
} from "@/features/billing/payment-methods";
import { PaymentMethodPicker } from "@/features/billing/components/payment-method-picker";
import { SettingsPageHeader } from "@/features/settings/components/settings-section";
import { listMyConnections } from "@/features/payments/connections";
import { PaymentConnectionsCard } from "@/features/payments/components/payment-connections-card";

export const metadata = {
  title: "Payments — Stackivo",
  description:
    "Set up how clients pay your invoices — Route Checkout, Smart Collect UPI, or UPI Direct.",
};

export default async function PaymentsSettingsPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);

  // Payment gateway is free for all plans — no feature gate here.
  const [summary, config, connections] = await Promise.all([
    getUserPaymentMethodSummary(user.id),
    getUserPaymentMethod(user.id),
    listMyConnections(),
  ]);

  // Pre-fill non-sensitive fields for the bank form.
  // Bank account number is intentionally NOT pre-filled — user must re-enter.
  const initialBank =
    config?.type === "stackivo_managed" || config?.type === "upi_smart"
      ? {
          accountHolderName: config.payout.accountHolderName,
          ifsc: config.payout.ifsc,
        }
      : undefined;

  const initialUpiVpa =
    config?.type === "upi_manual" ? config.payout.vpa : null;

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
        description="Choose how clients pay your invoices. Switch methods any time — no lock-in."
      />

      <div className="space-y-6">
        {showLegacyHint && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-4 text-xs leading-relaxed text-amber-800 dark:text-amber-400">
            <p className="font-semibold">We&apos;ve upgraded the payments experience.</p>
            <p className="mt-1">
              The old &quot;paste your Razorpay key&quot; flow is retired. Pick
              one of the three options below — Stackivo handles the rest.
            </p>
          </div>
        )}

        <PaymentMethodPicker
          summary={summary}
          initialBank={initialBank}
          initialUpiVpa={initialUpiVpa}
        />

        <PaymentConnectionsCard connections={connections} />

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              title: "Route Checkout",
              body: "Client pays via Razorpay — cards, UPI, net banking, or international. Invoice auto-marks paid. Payout to your bank within 1–2 business days.",
              note: "~2–3% fee",
            },
            {
              title: "Smart Collect",
              body: "A unique virtual UPI ID is created for each invoice. Client pays it via any UPI app. Invoice auto-marks paid the moment the transfer lands.",
              note: "~1.77% fee · India only",
            },
            {
              title: "UPI Direct",
              body: "Client scans a QR code for your UPI ID and pays directly. Instant, zero-fee. You confirm each payment manually and Stackivo issues the receipt.",
              note: "Free · Manual confirmation",
            },
          ].map(({ title, body, note }) => {
            const displayNote = title === "UPI Direct" ? note : "Coming soon";
            return (
            <div key={title} className="rounded-xl border bg-muted/20 p-4">
              <p className="mb-1.5 text-xs font-semibold text-foreground">{title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
              <p className="mt-2 text-[11px] font-medium text-muted-foreground/70">{displayNote}</p>
            </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
