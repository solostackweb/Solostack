import * as React from "react";
import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: { value: string; trend: "up" | "down" | "neutral" };
  icon?: LucideIcon;
  className?: string;
}

export function KpiCard({ label, value, delta, icon: Icon, className }: KpiCardProps) {
  const TrendIcon = delta?.trend === "down" ? TrendingDown : TrendingUp;
  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/[0.05]",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-micro font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          {Icon ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-indigo-500/10 text-primary ring-1 ring-primary/15">
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
        </div>
        <p className="mt-4 text-3xl font-bold tracking-tight">{value}</p>
        {delta ? (
          <div
            className={cn(
              "mt-2 flex items-center gap-1 text-xs font-medium",
              delta.trend === "up" && "text-success-strong",
              delta.trend === "down" && "text-destructive",
              delta.trend === "neutral" && "text-muted-foreground",
            )}
          >
            {delta.trend !== "neutral" ? (
              <TrendIcon className="h-3.5 w-3.5" />
            ) : null}
            {delta.value}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
