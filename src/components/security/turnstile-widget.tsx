"use client";

import * as React from "react";
import Script from "next/script";
import { env } from "@/config/env";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "auto" | "light" | "dark";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  name?: string;
  resetSignal?: unknown;
  onTokenChange?: (token: string) => void;
}

export function TurnstileWidget({
  name = "cf-turnstile-response",
  resetSignal,
  onTokenChange,
}: TurnstileWidgetProps) {
  const siteKey = env.turnstileSiteKey;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const widgetIdRef = React.useRef<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const [token, setToken] = React.useState("");

  const clearToken = React.useCallback(() => {
    setToken("");
    onTokenChange?.("");
  }, [onTokenChange]);

  React.useEffect(() => {
    if (!siteKey || !ready || !containerRef.current || !window.turnstile) return;
    if (widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "auto",
      callback: (value) => {
        setToken(value);
        onTokenChange?.(value);
      },
      "expired-callback": clearToken,
      "error-callback": clearToken,
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [clearToken, onTokenChange, ready, siteKey]);

  React.useEffect(() => {
    if (!resetSignal || !widgetIdRef.current || !window.turnstile) return;
    window.turnstile.reset(widgetIdRef.current);
    clearToken();
  }, [clearToken, resetSignal]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
        onReady={() => setReady(true)}
      />
      <input type="hidden" name={name} value={token} />
      <div ref={containerRef} className="min-h-[65px]" />
    </>
  );
}
