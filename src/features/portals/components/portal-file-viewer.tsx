"use client";

import Link from "next/link";
import { ArrowLeft, Download, FileText, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PortalFileViewer({
  portalId,
  title,
  mimeType,
  previewUrl,
  downloadUrl,
}: {
  portalId: string;
  title: string;
  mimeType: string | null;
  previewUrl: string;
  downloadUrl: string;
}) {
  const isImage = mimeType?.startsWith("image/");
  const isPreviewable =
    isImage ||
    mimeType?.includes("pdf") ||
    mimeType?.startsWith("text/") ||
    mimeType?.includes("json");

  async function share() {
    const nav = globalThis.navigator as
      | (Navigator & { share?: (data: ShareData) => Promise<void> })
      | undefined;
    const url = window.location.href;
    if (nav?.share) {
      await nav.share({ title, url });
      return;
    }
    await nav?.clipboard?.writeText(url);
  }

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100svh-3.5rem)] flex-col bg-background sm:-mx-6 sm:-my-10">
      <header
        className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 0.5rem)" }}
      >
        <Button asChild variant="ghost" size="icon" className="h-10 w-10 rounded-full">
          <Link href={`/portal/${portalId}/files`} aria-label="Back to files">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">{title}</h1>
          <p className="text-micro text-muted-foreground">File preview</p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={share} aria-label="Share">
          <Share2 className="h-4 w-4" />
        </Button>
        <Button asChild variant="ghost" size="icon" className="h-10 w-10 rounded-full">
          <a href={downloadUrl} aria-label="Download">
            <Download className="h-4 w-4" />
          </a>
        </Button>
      </header>

      <main className="min-h-0 flex-1 bg-muted/40">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={title} className="m-auto h-full max-h-full max-w-full object-contain" />
        ) : isPreviewable ? (
          <iframe title={title} src={previewUrl} className="h-full min-h-[calc(100svh-7rem)] w-full border-0 bg-background" />
        ) : (
          <div className="flex min-h-[calc(100svh-7rem)] items-center justify-center p-6">
            <div className="max-w-sm rounded-2xl border bg-card p-6 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <FileText className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-base font-semibold">Preview is not available</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                This file type can be downloaded and opened with the right app on your device.
              </p>
              <Button asChild className="mt-4 rounded-full">
                <a href={downloadUrl}>
                  <Download className="h-4 w-4" />
                  Download file
                </a>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
