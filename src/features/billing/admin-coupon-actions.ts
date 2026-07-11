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
  discountType: z.enum(["percent", "amount"]),
  discountValue: z.coerce.number().int().positive(),
  appliesToPlan: z.enum(["all", "pro", "business"]).default("all"),
  appliesToCycle: z.enum(["all", "monthly", "yearly"]).default("all"),
  maxRedemptions: z.coerce.number().int().positive().optional().nullable(),
  maxRedemptionsPerUser: z.coerce.number().int().positive().max(20).default(1),
  startsAt: z.string().optional(),
  expiresAt: z.string().optional(),
});

export async function adminCreateCouponAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const parsed = couponSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
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
  if (parsed.data.discountType === "percent" && parsed.data.discountValue > 100) {
    return { ok: false, error: "Percent coupons cannot exceed 100%." };
  }

  const code = normaliseCouponCode(parsed.data.code);

  return runAdminAction(
    {
      kind: "coupon.create",
      targetType: "coupon",
      targetId: code,
      metadata: {
        code,
        discount_type: parsed.data.discountType,
        discount_value: parsed.data.discountValue,
      },
    },
    async (actor) => {
      const admin = getAdminSupabase();
      const { error } = await admin.from("billing_coupons").insert({
        code,
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        discount_type: parsed.data.discountType,
        discount_value:
          parsed.data.discountType === "amount"
            ? parsed.data.discountValue * 100
            : parsed.data.discountValue,
        applies_to_plan: parsed.data.appliesToPlan,
        applies_to_cycle: parsed.data.appliesToCycle,
        max_redemptions: parsed.data.maxRedemptions ?? null,
        max_redemptions_per_user: parsed.data.maxRedemptionsPerUser,
        starts_at: parsed.data.startsAt ? new Date(parsed.data.startsAt).toISOString() : null,
        expires_at: parsed.data.expiresAt ? new Date(parsed.data.expiresAt).toISOString() : null,
        created_by: actor.id,
      } as never);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/admin/coupons");
      return { ok: true, message: "Coupon created." };
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
