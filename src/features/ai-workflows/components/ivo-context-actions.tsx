"use client";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openIvo } from "./ivo-entry-point";

export interface IvoContextAction {
  label: string;
  prompt: string;
}

interface IvoContextActionsProps {
  title: string;
  description?: string;
  actions: IvoContextAction[];
  className?: string;
}

export function IvoContextActions({
  title,
  description,
  actions,
  className,
}: IvoContextActionsProps) {
  if (actions.length === 0) return null;

  return (
    <section
      className={cn(
        "rounded-xl border bg-card/80 p-3 shadow-sm shadow-primary/[0.02] sm:p-4",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Ivo context
          </p>
          <h2 className="mt-1 text-sm font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap gap-2 sm:justify-end">
          {actions.map((action, index) => (
            <Button
              key={`${action.label}-${index}`}
              type="button"
              size="sm"
              variant={index === 0 ? "secondary" : "outline"}
              className="h-8 max-w-full gap-1.5 text-xs"
              onClick={() => openIvo(action.prompt)}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{action.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
