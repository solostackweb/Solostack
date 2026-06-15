"use client";

import * as React from "react";
import { UserPlus, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Downloads the freelancer's contact card (.vcf). */
export function SaveContactButton({ portalId }: { portalId: string }) {
  return (
    <Button asChild variant="outline" size="sm" className="h-8 rounded-full">
      <a href={`/api/portals/${portalId}/contact.vcf`} download>
        <UserPlus className="h-3.5 w-3.5" />
        Save contact
      </a>
    </Button>
  );
}

/** Shares the current portal link via the native share sheet (clipboard fallback). */
export function SharePortalButton({ portalName }: { portalName: string }) {
  const [copied, setCopied] = React.useState(false);

  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav && "share" in nav) {
      try {
        await nav.share({ title: portalName, url });
        return;
      } catch {
        /* user cancelled or unsupported — fall through to copy */
      }
    }
    try {
      await nav?.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  }

  return (
    <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={onShare}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      {copied ? "Link copied" : "Share"}
    </Button>
  );
}
