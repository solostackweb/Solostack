"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExternalLink, Monitor, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { portalClientHome } from "@/features/portals/routes";

interface PortalHeaderActionsProps {
  portalId: string;
  portalName: string;
  portalUrl: string;
  openAmount: string;
  paidAmount: string;
  fileCount: number;
  brandColor: string;
}

export function PortalHeaderActions({
  portalId,
  portalName,
  portalUrl,
  openAmount,
  paidAmount,
  fileCount,
  brandColor,
}: PortalHeaderActionsProps) {
  const [previewOpen, setPreviewOpen] = React.useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
        <PortalMoneyStat label="Open" value={openAmount} />
        <PortalMoneyStat label="Paid" value={paidAmount} />
        <PortalMoneyStat label="Files" value={String(fileCount)} />
        <Button asChild variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 self-center">
          <Link href={portalClientHome(portalId)} target="_blank">
            View as client <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 shrink-0 gap-1.5"
          onClick={() => setPreviewOpen(true)}
        >
          <Monitor className="h-3.5 w-3.5" />
          Preview
        </Button>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
          <DialogHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold">Client Portal Preview — {portalName}</DialogTitle>
              <Button variant="ghost" size="icon" onClick={() => setPreviewOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="h-[calc(90vh-120px)] w-full relative">
            <iframe
              src={portalUrl}
              className="w-full h-full rounded-lg border"
              title={`Client portal preview for ${portalName}`}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-background/80 px-3 py-1.5 rounded-full shadow-lg backdrop-blur">
              Preview mode — client will see this exact view at <code className="font-mono">{portalUrl}</code>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PortalMoneyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[7rem] shrink-0 rounded-lg border bg-background/70 px-3 py-2">
      <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate font-mono text-sm font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}