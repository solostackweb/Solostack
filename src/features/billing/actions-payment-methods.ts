"use server";

/**
 * Server actions for the payment-method picker.
 *
 * Methods:
 *   1. setBankPaymentMethodAction  — Smart Collect bank registration.
 *   2. setUpiManualMethodAction    — UPI VPA only, zero fee, manual confirm.
 *   3. setFeePassthroughAction     — toggle + percent for fee passthrough.
 *   4. clearPaymentMethodAction    — clears the active method.
 *
 * Verification steps (server-side)
 * ─────────────────────────────────
 *   • Account holder name:  min 2 chars
 *   • Bank account number:  6–18 digits (regex)
 *   • IFSC:                 /^[A-Z]{4}0[A-Z0-9]{6}$/ regex + IFSC API lookup
 *   • PAN:                  /^[A-Z]{5}[0-9]{4}[A-Z]$/ regex
 *   • UPI VPA:              NPCI VPA regex
 *   • Razorpay registration: Contact + Fund Account created via API
 *
 * Auth: all actions require an authenticated user; id is resolved from the
 * session — never trusted from form data.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import {
  clearPaymentMethod,
  saveBankPaymentMethod,
  saveUpiManualMethod,
  saveFeePassthrough,
  validateBankPayout,
  validateUpiVpa,
  IFSC_RE,
  PAN_RE,
  ACCT_RE,
} from "./payment-methods";
import { getOrCreateRouteVendor } from "./razorpay/route-vendor";
import { lookupIfsc } from "./razorpay/client";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; field?: string };

async function requireUserId(): Promise<string> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user.id;
}

// --- 1. Bank Account (Smart Collect UPI) -----------------------------------
//
// Smart Collect requires bank registration. Route Checkout is retired from the
// freelancer-facing flow because international invoices use connected methods.

const bankSchema = z.object({
  methodType: z.literal("upi_smart"),
  accountHolderName: z.string().trim().min(2).max(120),
  bankAccountNumber: z
    .string()
    .trim()
    .transform((v: string) => v.replace(/\s+/g, "")),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .min(11)
    .max(11),
  pan: z.string().trim().toUpperCase().min(10).max(10),
});

export async function setBankPaymentMethodAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = bankSchema.safeParse({
    methodType: formData.get("methodType"),
    accountHolderName: formData.get("accountHolderName"),
    bankAccountNumber: formData.get("bankAccountNumber"),
    ifsc: formData.get("ifsc"),
    pan: formData.get("pan"),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const firstField = Object.keys(flat)[0];
    return {
      ok: false,
      error:
        flat[firstField as keyof typeof flat]?.[0] ??
        "Please fill in all required fields.",
      field: firstField,
    };
  }

  const { methodType, accountHolderName, bankAccountNumber, ifsc, pan } =
    parsed.data;

  // --- Format validation ---------------------------------------------------
  if (!ACCT_RE.test(bankAccountNumber)) {
    return {
      ok: false,
      error: "Bank account number must be 6–18 digits with no spaces.",
      field: "bankAccountNumber",
    };
  }
  if (!IFSC_RE.test(ifsc)) {
    return {
      ok: false,
      error: "IFSC code is invalid. Expected format: HDFC0001234.",
      field: "ifsc",
    };
  }
  if (!PAN_RE.test(pan)) {
    return {
      ok: false,
      error: "PAN is invalid. Expected format: ABCDE1234F.",
      field: "pan",
    };
  }

  // --- IFSC live lookup (get canonical bank name) --------------------------
  const ifscData = await lookupIfsc(ifsc);
  if (!ifscData) {
    return {
      ok: false,
      error:
        "IFSC code not found. Please double-check it — it should appear on your cheque or passbook.",
      field: "ifsc",
    };
  }
  const bankName = ifscData.BANK;

  const bankDetails = {
    accountHolderName,
    bankAccountNumber,
    ifsc,
    bankName,
    pan,
  };

  const check = validateBankPayout(bankDetails);
  if (!check.ok) return check;

  const userId = await requireUserId();

  // --- Razorpay Contact + Fund Account registration -----------------------
  let routeIds: { contactId: string; fundAccountId: string };
  try {
    routeIds = await getOrCreateRouteVendor(userId, bankDetails);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      ok: false,
      error: `Could not register bank account with Razorpay: ${msg}. Please check the details and try again.`,
    };
  }

  // --- Persist to DB -------------------------------------------------------
  await saveBankPaymentMethod(userId, methodType, bankDetails, routeIds);
  revalidatePath("/dashboard/settings/payments");

  return {
    ok: true,
    message:
      "Smart Collect UPI enabled. Bank verified with Razorpay. Payouts land in your account within 1-2 business days of each payment.",
  };
}

// --- 2. UPI Manual (zero fee, direct to freelancer VPA) --------------------

const upiSchema = z.object({
  vpa: z.string().trim().min(5).max(120),
});

export async function setUpiManualMethodAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = upiSchema.safeParse({ vpa: formData.get("vpa") });
  if (!parsed.success) {
    return { ok: false, error: "Enter your UPI ID (e.g. yourname@okhdfcbank).", field: "vpa" };
  }
  const check = validateUpiVpa(parsed.data.vpa);
  if (!check.ok) return { ...check, field: "vpa" };

  const userId = await requireUserId();
  await saveUpiManualMethod(userId, { vpa: parsed.data.vpa });
  revalidatePath("/dashboard/settings/payments");
  return {
    ok: true,
    message:
      "UPI enabled. Clients will see a QR code on your invoices. Mark each invoice paid once you receive the transfer.",
  };
}

// --- 3. Fee passthrough toggle ----------------------------------------------

const feePassthroughSchema = z.object({
  enabled: z.enum(["true", "false"]).transform((v: string) => v === "true"),
  percent: z.coerce.number().min(0).max(10).optional(),
});

export async function setFeePassthroughAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = feePassthroughSchema.safeParse({
    enabled: formData.get("enabled"),
    percent: formData.get("percent") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid fee passthrough settings." };
  }
  const userId = await requireUserId();
  await saveFeePassthrough(userId, {
    enabled: parsed.data.enabled,
    percent: parsed.data.percent ?? null,
  });
  revalidatePath("/dashboard/settings/payments");
  return {
    ok: true,
    message: parsed.data.enabled
      ? "Fee passthrough on — transaction fees will appear as a line item on client invoices."
      : "Fee passthrough off — you absorb the transaction fee.",
  };
}

// --- 4. Clear method -------------------------------------------------------

export async function clearPaymentMethodAction(): Promise<ActionResult> {
  const userId = await requireUserId();
  await clearPaymentMethod(userId);
  revalidatePath("/dashboard/settings/payments");
  return { ok: true, message: "Payment method cleared." };
}

// --- Legacy compat shims ---------------------------------------------------
// These are used by old call sites that haven't been updated yet. They
// delegate to the new action.

export async function setManagedPaymentMethodAction(): Promise<ActionResult> {
  return {
    ok: false,
    error:
      "Route Checkout has been retired. Use UPI Direct for Indian clients and payment connections for international clients.",
  };
}
