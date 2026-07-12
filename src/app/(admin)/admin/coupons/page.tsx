import { TicketPercent } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminSection,
  AdminTable,
  AdminTableShell,
  AdminTd,
  AdminTh,
  AdminThead,
  AdminTr,
  Badge,
  Panel,
} from "@/components/admin/kit";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { formatINR } from "@/lib/format";
import type { BillingCouponRow } from "@/lib/supabase/types";
import { AdminCouponCreateForm } from "@/features/billing/components/admin-coupon-create-form";
import { AdminCouponToggle } from "@/features/billing/components/admin-coupon-toggle";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("billing_coupons")
    .select("*")
    .order("created_at", { ascending: false });
  const coupons = (data ?? []) as unknown as BillingCouponRow[];

  return (
    <AdminSection>
      <AdminPageHeader
        title="Coupons"
        subtitle="Create, pause, and monitor checkout discounts for Stackivo plans."
      />

      <Panel
        title="Create coupon"
        subtitle="Coupons are validated on the Stackivo checkout page and applied to the Razorpay subscription amount."
        icon={TicketPercent}
      >
        <AdminCouponCreateForm />
      </Panel>

      <AdminTableShell>
        <AdminTable>
          <AdminThead>
            <tr>
              <AdminTh>Code</AdminTh>
              <AdminTh>Discount</AdminTh>
              <AdminTh>Scope</AdminTh>
              <AdminTh>Redemptions</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Expires</AdminTh>
              <AdminTh />
            </tr>
          </AdminThead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No coupons yet.
                </td>
              </tr>
            ) : (
              coupons.map((coupon) => (
                <AdminTr key={coupon.id}>
                  <AdminTd>
                    <div className="font-mono text-sm font-semibold">{coupon.code}</div>
                    <div className="text-xs text-muted-foreground">{coupon.name}</div>
                  </AdminTd>
                  <AdminTd className="text-sm">
                    {coupon.grant_type === "free_access"
                      ? `${coupon.grant_duration_days ?? 365} days free`
                      : coupon.discount_type === "percent"
                        ? `${coupon.discount_value}%`
                        : formatINR(coupon.discount_value / 100)}
                  </AdminTd>
                  <AdminTd className="text-xs text-muted-foreground">
                    {coupon.applies_to_plan} / {coupon.applies_to_cycle}
                  </AdminTd>
                  <AdminTd className="text-xs tabular-nums">
                    {coupon.redeem_count}
                    {coupon.max_redemptions ? ` / ${coupon.max_redemptions}` : " / unlimited"}
                  </AdminTd>
                  <AdminTd>
                    <Badge tone={coupon.active ? "ok" : "neutral"}>
                      {coupon.active ? "Active" : "Paused"}
                    </Badge>
                  </AdminTd>
                  <AdminTd className="text-xs text-muted-foreground">
                    {coupon.expires_at
                      ? new Date(coupon.expires_at).toLocaleDateString("en-IN")
                      : "Never"}
                  </AdminTd>
                  <AdminTd className="text-right">
                    <AdminCouponToggle id={coupon.id} active={coupon.active} />
                  </AdminTd>
                </AdminTr>
              ))
            )}
          </tbody>
        </AdminTable>
      </AdminTableShell>
    </AdminSection>
  );
}
