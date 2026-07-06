"use client";
import { Sparkles } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const IVO_ASK_EVENT = "stackivo:ask-ivo";

export interface IvoAskDetail {
  prompt?: string;
}

interface IvoEntryPointProps
  extends Omit<ButtonProps, "children" | "onClick"> {
  prompt?: string;
  label?: string;
  iconOnly?: boolean;
}

export function openIvo(prompt?: string) {
  window.dispatchEvent(
    new CustomEvent<IvoAskDetail>(IVO_ASK_EVENT, {
      detail: { prompt },
    }),
  );
}

export function IvoEntryPoint({
  prompt,
  label = "Ask Ivo",
  iconOnly = false,
  className,
  variant = "outline",
  size = "sm",
  ...props
}: IvoEntryPointProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("gap-1.5", className)}
      onClick={() => openIvo(prompt)}
      {...props}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </Button>
  );
}
