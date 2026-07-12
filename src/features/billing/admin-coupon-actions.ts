"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { runAdminAction } from "@/features/admin/server";
import type { AdminActionResult } from "@/features/admin/actions";
import { normaliseCouponCode } from "./coupons";

const couponSchema = z.object({
  code: z.string().min(3).max(40),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  grantType: z.enum(["discount", "free_access"]).default("discount"),
  grantDurationDays: z.coerce.number().int().positive().optional().nullable(),
  discountType: z.enum(["percent", "amount"]),
  discountValue: z.coerce.number().int().positive().optional(),
  appliesToPlan: z.enum(["all", "pro", "business"]).default("all"),
  appliesToCycle: z.enum(["all", "monthly", "yearly"]).default("all"),
  maxRedemptions: z.coerce.number().int().positive().optional().nullable(),
  maxRedemptionsPerUser: z.coerce.number().int().positive().max(20).default(1),
  startsAt: z.string().optional(),
  expiresAt: z.string().optional(),
});

function parsedCouponPayload(parsed: z.infer<typeof couponSchema>) {
  return {
    code: normaliseCouponCode(parsed.code),
    name: parsed.name.trim(),
    description: parsed.description?.trim() || null,
    grant_type: parsed.grantType,
    grant_duration_days:
      parsed.grantType === "free_access"
        ? parsed.grantDurationDays ?? 365
        : null,
    discount_type:
      parsed.grantType === "free_access" ? "percent" : parsed.discountType,
    discount_value:
      parsed.grantType === "free_access"
        ? 100
        : parsed.discountType === "amount"
          ? (parsed.discountValue ?? 0) * 100
          : parsed.discountValue ?? 0,
    applies_to_plan: parsed.appliesToPlan,
    applies_to_cycle: parsed.appliesToCycle,
    max_redemptions: parsed.maxRedemptions ?? null,
    max_redemptions_per_user: parsed.maxRedemptionsPerUser,
    starts_at: parsed.startsAt ? new Date(parsed.startsAt).toISOString() : null,
    expires_at: parsed.expiresAt ? new Date(parsed.expiresAt).toISOString() : null,
  };
}

function validateCouponInput(parsed: z.infer<typeof couponSchema>): string | null {
  if (parsed.grantType === "discount" && parsed.discountValue === undefined) {
    return "Discount coupons need a value.";
  }
  if (
    parsed.grantType === "discount" &&
    parsed.discountType === "percent" &&
    (parsed.discountValue ?? 0) > 100
  ) {
    return "Percent coupons cannot exceed 100%.";
  }
  if (parsed.grantType === "free_access" && !parsed.grantDurationDays) {
    return "Free access coupons need a duration in days.";
  }
  if (
    parsed.startsAt &&
    parsed.expiresAt &&
    new Date(parsed.startsAt).getTime() >= new Date(parsed.expiresAt).getTime()
  ) {
    return "Expiry must be after the start date.";
  }
  return null;
}

export async function adminCreateCouponAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const parsed = couponSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    grantType: formData.get("grantType") || "discount",
    grantDurationDays: formData.get("grantDurationDays") || undefined,
    discountType: formData.get("discountType"),
    discountValue: formData.get("discountValue"),
    appliesToPlan: formData.get("appliesToPlan") || "all",
    appliesToCycle: formData.get("appliesToCycle") || "all",
    maxRedemptions: formData.get("maxRedemptions") || undefined,
    maxRedemptionsPerUser: formData.get("maxRedemptionsPerUser") || 1,
    startsAt: formData.get("startsAt") || undefined,
    expiresAt: formData.get("expiresAt") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid coupon." };
  }
  const validationError = validateCouponInput(parsed.data);
  if (validationError) return { ok: false, error: validationError };

  const code = normaliseCouponCode(parsed.data.code);

  return runAdminAction(
    {
      kind: "coupon.create",
      targetType: "coupon",
      targetId: code,
      metadata: {
        code,
        grant_type: parsed.data.grantType,
        discount_type: parsed.data.discountType,
        discount_value: parsed.data.discountValue ?? 100,
      },
    },
    async (actor) => {
      const admin = getAdminSupabase();
      const { error } = await admin.from("billing_coupons").insert({
        ...parsedCouponPayload(parsed.data),
        created_by: actor.id,
      } as never);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/admin/coupons");
      return { ok: true, message: "Coupon created." };
    },
  );
}

const couponIdSchema = z.string().uuid();

export async function adminUpdateCouponAction(
  id: string,
  formData: FormData,
): Promise<AdminActionResult> {
  const couponId = couponIdSchema.safeParse(id);
  if (!couponId.success) return { ok: false, error: "Invalid coupon." };

  const parsed = couponSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    grantType: formData.get("grantType") || "discount",
    grantDurationDays: formData.get("grantDurationDays") || undefined,
    discountType: formData.get("discountType"),
    discountValue: formData.get("discountValue"),
    appliesToPlan: formData.get("appliesToPlan") || "all",
    appliesToCycle: formData.get("appliesToCycle") || "all",
    maxRedemptions: formData.get("maxRedemptions") || undefined,
    maxRedemptionsPerUser: formData.get("maxRedemptionsPerUser") || 1,
    startsAt: formData.get("startsAt") || undefined,
    expiresAt: formData.get("expiresAt") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid coupon." };
  }
  const validationError = validateCouponInput(parsed.data);
  if (validationError) return { ok: false, error: validationError };

  return runAdminAction(
    {
      kind: "coupon.update",
      targetType: "coupon",
      targetId: couponId.data,
      metadata: {
        code: normaliseCouponCode(parsed.data.code),
        grant_type: parsed.data.grantType,
        discount_type: parsed.data.discountType,
        discount_value: parsed.data.discountValue ?? 100,
      },
    },
    async () => {
      const admin = getAdminSupabase();
      const { error } = await admin
        .from("billing_coupons")
        .update(parsedCouponPayload(parsed.data) as never)
        .eq("id", couponId.data);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/admin/coupons");
      revalidatePath("/dashboard/checkout");
      return { ok: true, message: "Coupon updated." };
    },
  );
}

const toggleSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
});

export async function adminSetCouponActiveAction(
  input: z.input<typeof toggleSchema>,
): Promise<AdminActionResult> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid coupon." };

  return runAdminAction(
    {
      kind: "coupon.update",
      targetType: "coupon",
      targetId: parsed.data.id,
      metadata: { active: parsed.data.active },
    },
    async () => {
      const admin = getAdminSupabase();
      const { error } = await admin
        .from("billing_coupons")
        .update({ active: parsed.data.active } as never)
        .eq("id", parsed.data.id);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/admin/coupons");
      return {
        ok: true,
        message: parsed.data.active ? "Coupon activated." : "Coupon paused.",
      };
    },
  );
}

export async function adminDeleteCouponAction(
  id: string,
): Promise<AdminActionResult> {
  const parsed = couponIdSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid coupon." };

  return runAdminAction(
    {
      kind: "coupon.delete",
      targetType: "coupon",
      targetId: parsed.data,
    },
    async () => {
      const admin = getAdminSupabase();
      const { count, error: countError } = await admin
        .from("billing_coupon_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", parsed.data);
      if (countError) return { ok: false, error: countError.message };
      if ((count ?? 0) > 0) {
        return {
          ok: false,
          error: "This coupon has redemption history. Pause it instead.",
        };
      }

      const { error } = await admin
        .from("billing_coupons")
        .delete()
        .eq("id", parsed.data);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/admin/coupons");
      return { ok: true, message: "Coupon deleted." };
    },
  );
}
