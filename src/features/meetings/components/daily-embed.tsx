"use client";

import * as React from "react";

/**
 * Embeds a Daily.co call using the official daily-js SDK (loaded from CDN, so
 * no bundler dependency). The SDK sizes the call to its container, requests
 * camera/mic permissions correctly, and emits a "left-meeting" event we use to
 * show a closing message. Falls back to an "open in new tab" link if the SDK
 * can't load.
 */

type DailyFrame = {
  join: (options: { url: string }) => void;
  on: (event: string, handler: () => void) => void;
  destroy: () => void;
  iframe?: () => HTMLIFrameElement | null;
};

// Permissions the embedded call needs the browser to prompt for.
const IFRAME_ALLOW =
  "camera; microphone; autoplay; display-capture; fullscreen; speaker; screen-wake-lock";
type DailyGlobal = {
  createFrame: (el: HTMLElement, props: Record<string, unknown>) => DailyFrame;
};
declare global {
  interface Window {
    DailyIframe?: DailyGlobal;
  }
}

const SCRIPT_SRC = "https://unpkg.com/@daily-co/daily-js";

function loadDaily(): Promise<DailyGlobal> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("no window"));
      return;
    }
    if (window.DailyIframe) {
      resolve(window.DailyIframe);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-daily]",
    );
    const onReady = () =>
      window.DailyIframe
        ? resolve(window.DailyIframe)
        : reject(new Error("daily unavailable"));
    if (existing) {
      existing.addEventListener("load", onReady);
      existing.addEventListener("error", () => reject(new Error("load error")));
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.setAttribute("data-daily", "1");
    script.onload = onReady;
    script.onerror = () => reject(new Error("load error"));
    document.body.appendChild(script);
  });
}

export function DailyEmbed({
  url,
  onLeft,
}: {
  url: string;
  /** Kept for backwards-compatibility; unused by the SDK. */
  title?: string;
  onLeft?: () => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const frameRef = React.useRef<DailyFrame | null>(null);
  const onLeftRef = React.useRef(onLeft);
  onLeftRef.current = onLeft;
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    loadDaily()
      .then((Daily) => {
        if (!active || !containerRef.current) return;
        const frame = Daily.createFrame(containerRef.current, {
          showLeaveButton: true,
          iframeStyle: {
            width: "100%",
            height: "100%",
            border: "0",
            borderRadius: "12px",
          },
        });
        frameRef.current = frame;
        // Explicitly declare the media permissions on the iframe so the
        // browser prompts for camera/mic. The parent page delegates these
        // features via the Permissions-Policy header (see middleware.ts);
        // without both halves, browsers deny getUserMedia without asking.
        try {
          const el = frame.iframe?.();
          if (el) el.setAttribute("allow", IFRAME_ALLOW);
        } catch {
          /* older SDKs manage the allow attribute themselves */
        }
        frame.on("left-meeting", () => onLeftRef.current?.());
        frame.join({ url });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      try {
        frameRef.current?.destroy();
      } catch {
        /* ignore */
      }
      frameRef.current = null;
    };
  }, [url]);

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="aspect-video max-h-[78vh] w-full overflow-hidden rounded-xl border bg-black"
      />
      {failed ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Trouble loading the call?{" "}
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline"
          >
            Open in a new tab
          </a>
        </p>
      ) : null}
    </div>
  );
}

/** Regex-only check so client components can branch without importing server code. */
export function isEmbeddableRoom(url: string | null | undefined): boolean {
  return Boolean(url && /\.daily\.co\//i.test(url));
}
