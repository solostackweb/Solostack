import { redirect } from "next/navigation";

/** Pricing is intentionally paused during Stackivo's early-access period. */
export default function PricingPage() {
  redirect("/community");
}
