"use client";

import { AlertTriangle, Lightbulb, Sparkles } from "lucide-react";

import type { AssistantSuggestion } from "@/features/ai-workflows/suggestions";
import { cn } from "@/lib/utils";
import { IvoEntryPoint } from "./ivo-entry-point";

interface IvoWorkspaceNudgesProps {
  suggestions: AssistantSuggestion[];
}

export function IvoWorkspaceNudges({ suggestions }: IvoWorkspaceNudgesProps) {
  if (suggestions.length === 0) return null;

  return (
    <section className="rounded-xl border border-primary/15 bg-primary/[0.035] p-4 shadow-sm shadow-primary/[0.03] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">Ivo noticed</p>
              <p className="text-xs text-muted-foreground">
                A few workspace signals worth checking today.
              </p>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
          {suggestions.map((item) => {
            const Icon = item.tone === "alert" ? AlertTriangle : Lightbulb;
            return (
              <div
                key={item.id}
                className={cn(
                  "flex min-w-0 flex-col justify-between gap-3 rounded-lg border bg-background/85 p-3",
                  item.tone === "alert" ? "border-destructive/20" : "border-primary/15",
                )}
              >
                <div className="flex min-w-0 gap-2">
                  <Icon
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5 shrink-0",
                      item.tone === "alert" ? "text-destructive" : "text-primary",
                    )}
                  />
                  <p className="min-w-0 text-sm leading-snug text-foreground">
                    {item.title}
                  </p>
                </div>
                <IvoEntryPoint
                  prompt={item.prompt}
                  label="Ask Ivo"
                  variant={item.tone === "alert" ? "default" : "outline"}
                  className="h-8 justify-center"
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
