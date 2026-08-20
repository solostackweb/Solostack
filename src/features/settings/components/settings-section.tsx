"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title: string;
  description?: string;
  /** Render an inline header action (e.g. a small "Manage" button). */
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /**
   * When `onSave` is provided, renders a sticky-ish footer with Cancel + Save
   * buttons. Most pages just wire this up to a toast placeholder.
   */
  onSave?: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  isDirty?: boolean;
  isSubmitting?: boolean;
  /** Render a danger accent along the top — used by the Delete account card. */
  tone?: "default" | "danger";
  /** Optional badge rendered next to the title — e.g. "Coming soon". */
  badge?: string;
}

/**
 * Reusable Settings section card. Consistent typography + spacing across every
 * page of the Settings module. Keep body content lean — this component owns
 * the chrome (border, header, optional footer).
 */
export function SettingsSection({
  title,
  description,
  headerAction,
  children,
  className,
  onSave,
  onCancel,
  saveLabel = "Save changes",
  isDirty,
  isSubmitting,
  tone = "default",
  badge,
}: SettingsSectionProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden",
        tone === "danger" && "border-t-2 border-t-destructive",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b px-6 py-5">
        <div className="min-w-0">
          <h3
            className={cn(
              "text-base font-semibold tracking-tight",
              tone === "danger" && "text-destructive",
            )}
          >
            {title}
            {badge && (
              <Badge variant="secondary" className="ml-2 align-middle text-xs">
                {badge}
              </Badge>
            )}
          </h3>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </header>

      <div className="space-y-5 px-6 py-6">{children}</div>

      {onSave && (
        <footer className="flex items-center justify-end gap-2 border-t bg-muted/30 px-6 py-3">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={isSubmitting || isDirty === false}
          >
            {isSubmitting ? "Saving…" : saveLabel}
          </Button>
        </footer>
      )}
    </Card>
  );
}

/**
 * A single form row inside a settings section. Keeps label + input + help text
 * aligned across the module.
 */
export function SettingsField({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-micro font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-micro text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * A labelled toggle row used throughout Notifications + Appearance. Keeps the
 * switch right-aligned with a consistent label/description stack on the left.
 */
export function SettingsToggleRow({
  label,
  description,
  children,
  className,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b py-4 last:border-b-0 last:pb-0 first:pt-0",
        className,
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="mt-0.5 shrink-0">{children}</div>
    </div>
  );
}

/** Convenience: the default placeholder "Save" handler used by most stubs. */
export function useStubSaveHandler(entity: string) {
  return React.useCallback(() => {
    toast.success(`${entity} saved`);
  }, [entity]);
}

/**
 * Standard page header used at the top of every Settings page. Provides a
 * consistent title + description pair separated from the cards below by a
 * subtle divider.
 */
export function SettingsPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1 border-b pb-6">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
