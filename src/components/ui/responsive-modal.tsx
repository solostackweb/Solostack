"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * Renders a centered Dialog on desktop and a bottom Sheet on mobile — the
 * single biggest "native feel" win, since drawers that slide up from the
 * bottom read as app-native while centered modals read as web.
 *
 * Controlled via `open` / `onOpenChange`. Use for create/edit forms, the row
 * "…" action menus, filters, and pickers.
 */
export function useIsMobile(query = "(max-width: 767px)") {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return isMobile;
}

export interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Extra classes for the content surface. */
  className?: string;
  /** Hide the header (when the body supplies its own). */
  hideHeader?: boolean;
}

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  hideHeader = false,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={`flex max-h-[92svh] flex-col gap-0 overflow-hidden p-0 ${className ?? ""}`}
        >
          {/* Grab handle — the universal "this is a sheet" affordance. */}
          <div className="flex shrink-0 justify-center pt-2.5">
            <span className="h-1.5 w-10 rounded-full bg-muted-foreground/25" aria-hidden />
          </div>
          {!hideHeader && (title || description) ? (
            <SheetHeader className="shrink-0 px-5 pb-2 pt-3 text-left">
              {title ? <SheetTitle>{title}</SheetTitle> : null}
              {description ? <SheetDescription>{description}</SheetDescription> : null}
            </SheetHeader>
          ) : null}
          <div className="momentum-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom,0px),1rem)] pt-1">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        {!hideHeader && (title || description) ? (
          <DialogHeader>
            {title ? <DialogTitle>{title}</DialogTitle> : null}
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
        ) : null}
        {children}
      </DialogContent>
    </Dialog>
  );
}
