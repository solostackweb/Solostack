"use client";

import Link from "next/link";
import { ArrowUpRight, Bot, Sparkles, Wand2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { openIvo } from "@/features/ai-workflows/components/ivo-entry-point";
import type { AutomationSuggestionRecord } from "@/features/automation/server";

const TONE_STYLES = {
  info: "border-primary/20 bg-primary/5",
  warning: "border-warning-subtle bg-warning-subtle",
  danger: "border-destructive/25 bg-destructive/10",
} as const;

export function AutomationSuggestions({
  suggestions,
}: {
  suggestions: AutomationSuggestionRecord[];
}) {
  return (
    <Card className="overflow-hidden border-border/70">
      <CardHeader className="flex flex-col gap-3 border-b bg-muted/20 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight">
            <Wand2 className="h-4 w-4 text-primary" />
            Automation suggestions
          </CardTitle>
          <CardDescription className="text-xs">
            Ivo spots repeatable admin, then waits for your approval.
          </CardDescription>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-micro font-semibold text-muted-foreground">
          <Bot className="h-3.5 w-3.5" />
          Approval first
        </span>
      </CardHeader>
      <CardContent className="p-3 sm:p-4">
        {suggestions.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No automation needed right now"
            description="When invoices, proposals, contracts, or unbilled time need attention, Ivo will suggest the next move here."
            className="min-h-[160px]"
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={cn(
                  "flex min-w-0 flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between",
                  TONE_STYLES[suggestion.tone],
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{suggestion.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {suggestion.description}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                    <Link href={suggestion.href} aria-label={`Open ${suggestion.title}`}>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => openIvo(suggestion.prompt)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Ask Ivo
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
