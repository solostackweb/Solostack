"use client";

import * as React from "react";
import {
  FileText,
  FileSignature,
  FileCheck2,
  ShieldCheck,
  ListChecks,
  LayoutTemplate,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ContractKind, ContractTemplate } from "../types";

// Picker-local labels — covers the wider set of mock template kinds even
// though the DB only persists "proposal" and "contract".
const TEMPLATE_KIND_LABEL: Record<ContractKind, string> = {
  proposal: "Proposal",
  contract: "Contract",
  msa: "Master Services Agreement",
  nda: "NDA",
  sow: "Statement of Work",
};

const KIND_ICON: Record<ContractKind, LucideIcon> = {
  proposal: LayoutTemplate,
  contract: FileSignature,
  msa: ShieldCheck,
  nda: FileCheck2,
  sow: ListChecks,
};

interface TemplatePickerProps {
  templates: ContractTemplate[];
  selectedId?: string;
  onSelect: (template: ContractTemplate) => void;
  className?: string;
}

/**
 * Grid of template cards. Used on the "new contract" page and in any future
 * quick-start dialog. The selected state keyed by id so the parent form
 * stays in control.
 */
export function TemplatePicker({
  templates,
  selectedId,
  onSelect,
  className,
}: TemplatePickerProps) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {templates.map((t) => {
        const Icon = KIND_ICON[t.kind] ?? FileText;
        const selected = t.id === selectedId;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            aria-pressed={selected}
            className={cn(
              "group text-left transition-all focus:outline-none",
              selected && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg",
            )}
          >
            <Card
              className={cn(
                "h-full transition-colors group-hover:border-foreground/20",
                selected && "border-primary",
              )}
            >
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  {t.popular && (
                    <Badge variant="secondary" className="text-xs">
                      Popular
                    </Badge>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {t.name}
                  </p>
                  <p className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
                    {TEMPLATE_KIND_LABEL[t.kind]}
                  </p>
                  <p className="line-clamp-2 pt-1 text-xs text-muted-foreground">
                    {t.description}
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>{t.highlights.length} sections</span>
                  {t.readingTime > 0 && <span>~{t.readingTime} min read</span>}
                </div>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
