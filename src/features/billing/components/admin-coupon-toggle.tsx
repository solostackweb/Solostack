"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminSetCouponActiveAction } from "../admin-coupon-actions";

export function AdminCouponToggle({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await adminSetCouponActiveAction({ id, active: !active });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success(res.message ?? "Coupon updated.");
        });
      }}
    >
      {active ? "Pause" : "Activate"}
    </Button>
  );
}
