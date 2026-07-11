"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { BillingCycle } from "../types";

interface CheckoutButtonProps {
  plan: "pro" | "business";
  cycle: BillingCycle;
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  disabled?: boolean;
}

export function CheckoutButton({
  plan,
  cycle,
  label,
  variant = "default",
  size = "default",
  className,
  disabled,
}: CheckoutButtonProps) {
  const href = `/dashboard/checkout?plan=${plan}&cycle=${cycle}`;
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled}
      asChild={!disabled}
    >
      {disabled ? (
        label ?? "Checkout unavailable"
      ) : (
        <Link href={href}>{label ?? "Continue to checkout"}</Link>
      )}
    </Button>
  );
}
