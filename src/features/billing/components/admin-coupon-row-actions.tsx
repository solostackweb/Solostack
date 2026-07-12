"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Edit3, MoreHorizontal, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { BillingCouponRow } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  adminDeleteCouponAction,
  adminSetCouponActiveAction,
  adminUpdateCouponAction,
} from "../admin-coupon-actions";

export function AdminCouponRowActions({ coupon }: { coupon: BillingCouponRow }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const refreshAfter = (message: string) => {
    toast.success(message);
    router.refresh();
  };

  const toggleActive = () => {
    startTransition(async () => {
      const res = await adminSetCouponActiveAction({
        id: coupon.id,
        active: !coupon.active,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      refreshAfter(res.message ?? "Coupon updated.");
    });
  };

  const deleteCoupon = async () => {
    const ok = await confirm({
      title: `Delete ${coupon.code}?`,
      description:
        "Unused coupons can be deleted. Coupons with redemption history must be paused instead so billing records stay traceable.",
      confirmLabel: "Delete coupon",
      variant: "destructive",
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await adminDeleteCouponAction(coupon.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      refreshAfter(res.message ?? "Coupon deleted.");
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="icon" disabled={pending}>
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Coupon actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setEditOpen(true);
            }}
          >
            <Edit3 />
            Edit coupon
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              toggleActive();
            }}
          >
            {coupon.active ? <Pause /> : <Play />}
            {coupon.active ? "Pause coupon" : "Activate coupon"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(event) => {
              event.preventDefault();
              void deleteCoupon();
            }}
          >
            <Trash2 />
            Delete coupon
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit coupon</DialogTitle>
            <DialogDescription>
              Changes apply to future checkout attempts. Existing billing records remain unchanged.
            </DialogDescription>
          </DialogHeader>
          <CouponEditForm
            coupon={coupon}
            pending={pending}
            onCancel={() => setEditOpen(false)}
            onSaved={(message) => {
              setEditOpen(false);
              refreshAfter(message);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function CouponEditForm({
  coupon,
  pending,
  onCancel,
  onSaved,
}: {
  coupon: BillingCouponRow;
  pending: boolean;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [saving, startTransition] = React.useTransition();
  const isPending = pending || saving;

  return (
    <form
      className="grid gap-4 lg:grid-cols-12"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const res = await adminUpdateCouponAction(coupon.id, formData);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          onSaved(res.message ?? "Coupon updated.");
        });
      }}
    >
      <label className="space-y-1.5 lg:col-span-3">
        <span className="text-xs font-medium text-muted-foreground">Code</span>
        <Input name="code" defaultValue={coupon.code} required />
      </label>
      <label className="space-y-1.5 lg:col-span-5">
        <span className="text-xs font-medium text-muted-foreground">Name</span>
        <Input name="name" defaultValue={coupon.name} required />
      </label>
      <label className="space-y-1.5 lg:col-span-4">
        <span className="text-xs font-medium text-muted-foreground">Benefit</span>
        <select
          name="grantType"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue={coupon.grant_type}
        >
          <option value="discount">Discounted checkout</option>
          <option value="free_access">Free plan access</option>
        </select>
      </label>
      <label className="space-y-1.5 lg:col-span-3">
        <span className="text-xs font-medium text-muted-foreground">Type</span>
        <select
          name="discountType"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue={coupon.discount_type}
        >
          <option value="percent">Percent</option>
          <option value="amount">Amount INR</option>
        </select>
      </label>
      <label className="space-y-1.5 lg:col-span-3">
        <span className="text-xs font-medium text-muted-foreground">Discount value</span>
        <Input
          name="discountValue"
          type="number"
          min={1}
          defaultValue={
            coupon.grant_type === "free_access"
              ? ""
              : coupon.discount_type === "amount"
                ? coupon.discount_value / 100
                : coupon.discount_value
          }
          placeholder="30"
        />
      </label>
      <label className="space-y-1.5 lg:col-span-3">
        <span className="text-xs font-medium text-muted-foreground">Access days</span>
        <Input
          name="grantDurationDays"
          type="number"
          min={1}
          defaultValue={coupon.grant_duration_days ?? ""}
          placeholder="365"
        />
      </label>
      <label className="space-y-1.5 lg:col-span-3">
        <span className="text-xs font-medium text-muted-foreground">Plan</span>
        <select
          name="appliesToPlan"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue={coupon.applies_to_plan}
        >
          <option value="all">All</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
        </select>
      </label>
      <label className="space-y-1.5 lg:col-span-3">
        <span className="text-xs font-medium text-muted-foreground">Cycle</span>
        <select
          name="appliesToCycle"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue={coupon.applies_to_cycle}
        >
          <option value="all">All</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </label>
      <label className="space-y-1.5 lg:col-span-3">
        <span className="text-xs font-medium text-muted-foreground">Max uses</span>
        <Input
          name="maxRedemptions"
          type="number"
          min={1}
          defaultValue={coupon.max_redemptions ?? ""}
          placeholder="Unlimited"
        />
      </label>
      <label className="space-y-1.5 lg:col-span-3">
        <span className="text-xs font-medium text-muted-foreground">Per user</span>
        <Input
          name="maxRedemptionsPerUser"
          type="number"
          min={1}
          defaultValue={coupon.max_redemptions_per_user}
        />
      </label>
      <label className="space-y-1.5 lg:col-span-6">
        <span className="text-xs font-medium text-muted-foreground">Description</span>
        <Input name="description" defaultValue={coupon.description ?? ""} />
      </label>
      <label className="space-y-1.5 lg:col-span-3">
        <span className="text-xs font-medium text-muted-foreground">Starts optional</span>
        <Input name="startsAt" type="datetime-local" defaultValue={toDateTimeLocal(coupon.starts_at)} />
      </label>
      <label className="space-y-1.5 lg:col-span-3">
        <span className="text-xs font-medium text-muted-foreground">Expires optional</span>
        <Input name="expiresAt" type="datetime-local" defaultValue={toDateTimeLocal(coupon.expires_at)} />
      </label>
      <DialogFooter className="lg:col-span-12">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
