"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminCreateCouponAction } from "../admin-coupon-actions";

export function AdminCouponCreateForm() {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [pending, startTransition] = React.useTransition();

  return (
    <form
      ref={formRef}
      className="grid gap-4 lg:grid-cols-12"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const res = await adminCreateCouponAction(formData);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success(res.message ?? "Coupon created.");
          formRef.current?.reset();
          router.refresh();
        });
      }}
    >
      <label className="space-y-1.5 lg:col-span-2">
        <span className="text-xs font-medium text-muted-foreground">Code</span>
        <Input name="code" placeholder="LAUNCH30" required />
      </label>
      <label className="space-y-1.5 lg:col-span-3">
        <span className="text-xs font-medium text-muted-foreground">Name</span>
        <Input name="name" placeholder="Launch discount" required />
      </label>
      <label className="space-y-1.5 lg:col-span-2">
        <span className="text-xs font-medium text-muted-foreground">Benefit</span>
        <select
          name="grantType"
          className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
          defaultValue="discount"
        >
          <option value="discount">Discounted checkout</option>
          <option value="free_access">Free plan access</option>
        </select>
      </label>
      <label className="space-y-1.5 lg:col-span-2">
        <span className="text-xs font-medium text-muted-foreground">Type</span>
        <select
          name="discountType"
          className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
          defaultValue="percent"
        >
          <option value="percent">Percent</option>
          <option value="amount">Amount INR</option>
        </select>
      </label>
      <label className="space-y-1.5 lg:col-span-2">
        <span className="text-xs font-medium text-muted-foreground">Discount value</span>
        <Input name="discountValue" type="number" min={1} placeholder="30" />
      </label>
      <label className="space-y-1.5 lg:col-span-2">
        <span className="text-xs font-medium text-muted-foreground">Access days</span>
        <Input name="grantDurationDays" type="number" min={1} placeholder="365" />
      </label>
      <label className="space-y-1.5 lg:col-span-1">
        <span className="text-xs font-medium text-muted-foreground">Plan</span>
        <select name="appliesToPlan" className="h-9 w-full rounded-lg border bg-background px-2 text-sm">
          <option value="all">All</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
        </select>
      </label>
      <label className="space-y-1.5 lg:col-span-2">
        <span className="text-xs font-medium text-muted-foreground">Cycle</span>
        <select name="appliesToCycle" className="h-9 w-full rounded-lg border bg-background px-2 text-sm">
          <option value="all">All</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </label>
      <label className="space-y-1.5 lg:col-span-2">
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
        <span className="text-xs font-medium text-muted-foreground">Starts optional</span>
        <Input name="startsAt" type="datetime-local" />
      </label>
      <label className="space-y-1.5 lg:col-span-2">
        <span className="text-xs font-medium text-muted-foreground">Expires optional</span>
        <Input name="expiresAt" type="datetime-local" />
      </label>
      <div className="flex items-end lg:col-span-1">
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating..." : "Create"}
        </Button>
      </div>
    </form>
  );
}
