"use client";

/**
 * QR card — generates a scannable code for the client portal link so the
 * freelancer can hand off access in a meeting or on a card. `qrcode` is
 * lazy-imported (loosely typed) so the project compiles before `npm install`.
 */

import * as React from "react";
import { QrCode, Loader2, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { portalClientHome } from "../routes";

interface QrCodeModule {
  toDataURL: (text: string, opts?: Record<string, unknown>) => Promise<string>;
}

export function PortalQrCard({ portalId }: { portalId: string }) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onToggle() {
    if (dataUrl) {
      setOpen((v) => !v);
      return;
    }
    setPending(true);
    try {
      const url = `${window.location.origin}${portalClientHome(portalId)}`;
      const moduleName = "qrcode";
      const mod = (await import(moduleName)) as unknown as
        { default?: QrCodeModule } & QrCodeModule;
      const lib = (mod.default ?? mod) as QrCodeModule;
      const png = await lib.toDataURL(url, { width: 240, margin: 1 });
      setDataUrl(png);
      setOpen(true);
    } catch {
      /* qrcode not installed yet — no-op */
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <QrCode className="h-4 w-4" />
          Portal QR
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          A scannable code that opens this client portal — share it in a meeting
          or print it on a card.
        </p>
        <Button size="sm" variant="outline" className="w-full" onClick={onToggle} disabled={pending}>
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <QrCode className="h-3.5 w-3.5" />
          )}
          {open && dataUrl ? "Hide QR code" : "Show QR code"}
        </Button>
        {open && dataUrl && (
          <div className="flex flex-col items-center gap-2 rounded-lg border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUrl} alt="Portal QR code" className="h-40 w-40" />
            <a
              href={dataUrl}
              download={`portal-${portalId}-qr.png`}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              <Download className="h-3 w-3" /> Download
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
