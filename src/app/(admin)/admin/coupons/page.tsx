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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { formatINR } from "@/lib/format";
import type { BillingCouponRow } from "@/lib/supabase/types";
import { adminCreateCouponAction } from "@/features/billing/admin-coupon-actions";
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
        <form action={adminCreateCouponAction} className="grid gap-4 lg:grid-cols-12">
          <label className="space-y-1.5 lg:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Code</span>
            <Input name="code" placeholder="LAUNCH30" required />
          </label>
          <label className="space-y-1.5 lg:col-span-3">
            <span className="text-xs font-medium text-muted-foreground">Name</span>
            <Input name="name" placeholder="Launch discount" required />
          </label>
          <label className="space-y-1.5 lg:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Type</span>
            <select
              name="discountType"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              defaultValue="percent"
            >
              <option value="percent">Percent</option>
              <option value="amount">Amount INR</option>
            </select>
          </label>
          <label className="space-y-1.5 lg:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Value</span>
            <Input name="discountValue" type="number" min={1} placeholder="30" required />
          </label>
          <label className="space-y-1.5 lg:col-span-1">
            <span className="text-xs font-medium text-muted-foreground">Plan</span>
            <select name="appliesToPlan" className="h-9 w-full rounded-md border bg-background px-2 text-sm">
              <option value="all">All</option>
              <option value="pro">Pro</option>
              <option value="business">Business</option>
            </select>
          </label>
          <label className="space-y-1.5 lg:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Cycle</span>
            <select name="appliesToCycle" className="h-9 w-full rounded-md border bg-background px-2 text-sm">
              <option value="all">All</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <label className="space-y-1.5 lg:col-span-3">
            <span className="text-xs font-medium text-muted-foreground">Description</span>
            <Input name="description" placeholder="Optional internal note" />
          </label>
          <label className="space-y-1.5 lg:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Max uses</span>
            <Input name="maxRedemptions" type="number" min={1} placeholder="Unlimited" />
          </label>
          <label className="space-y-1.5 lg:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Per user</span>
            <Input name="maxRedemptionsPerUser" type="number" min={1} defaultValue={1} />
          </label>
          <label className="space-y-1.5 lg:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Starts</span>
            <Input name="startsAt" type="datetime-local" />
          </label>
          <label className="space-y-1.5 lg:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Expires</span>
            <Input name="expiresAt" type="datetime-local" />
          </label>
          <div className="flex items-end lg:col-span-1">
            <Button type="submit" className="w-full">Create</Button>
          </div>
        </form>
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
                    {coupon.discount_type === "percent"
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
