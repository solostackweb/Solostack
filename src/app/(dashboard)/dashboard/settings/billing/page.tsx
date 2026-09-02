import { redirect } from "next/navigation";

/** Billing UI is paused; the underlying subscription system remains intact. */
export default function BillingSettingsPage() {
  redirect("/dashboard/settings/profile");
}
