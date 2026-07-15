"use client";

import * as React from "react";

/**
 * Embeds a Daily.co Prebuilt room via an iframe — no SDK dependency. The
 * caller only renders this once the user opts to join, so cameras aren't
 * requested on page load.
 */
export function DailyEmbed({
  url,
  title = "Video call",
}: {
  url: string;
  title?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-black">
      <iframe
        src={url}
        title={title}
        allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
        className="h-[70vh] max-h-[640px] w-full"
      />
    </div>
  );
}

/** Regex-only check so client components can branch without importing server code. */
export function isEmbeddableRoom(url: string | null | undefined): boolean {
  return Boolean(url && /\.daily\.co\//i.test(url));
}
