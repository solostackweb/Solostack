"use client";
import { Sparkles } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IvoResourceReference } from "@/features/ai-workflows/resource-mentions";

export const IVO_ASK_EVENT = "stackivo:ask-ivo";

export interface IvoAskDetail {
  prompt?: string;
  resources?: Array<IvoResourceReference & { label: string; subtitle: string }>;
}

interface IvoEntryPointProps
  extends Omit<ButtonProps, "children" | "onClick"> {
  prompt?: string;
  label?: string;
  iconOnly?: boolean;
  resources?: IvoAskDetail["resources"];
}

export function openIvo(prompt?: string, resources?: IvoAskDetail["resources"]) {
  window.dispatchEvent(
    new CustomEvent<IvoAskDetail>(IVO_ASK_EVENT, {
      detail: { prompt, resources },
    }),
  );
}

export function IvoEntryPoint({
  prompt,
  label = "Ask Ivo",
  iconOnly = false,
  resources,
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
      onClick={() => openIvo(prompt, resources)}
      {...props}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </Button>
  );
}
