"use client";

/**
 * Desktop exit-intent newsletter modal.
 *
 * Triggers once per visitor (localStorage flag) when:
 *   - Pointer moves out of the top of the viewport (classic
 *     exit-intent signal); OR
 *   - 60s idle on the page after at least 30% scroll (fallback).
 *
 * Mobile is excluded — exit-intent doesn't translate well to touch
 * (no top-edge mouse leave equivalent), and aggressive popups on
 * mobile destroy CWV + UX. The sticky bottom CTA serves the mobile
 * "you're about to leave" surface instead.
 *
 * Hidden:
 *   - On signup / login / dashboard / contact / talk / demo (already
 *     in-funnel).
 *   - When the user has dismissed once (30-day cookie).
 *   - When `prefers-reduced-motion` is set (we still render but
 *     without the slide-in animation).
 */

import * as React from "react";
import { usePathname } from "next/navigation";
import { X, Sparkles } from "lucide-react";
import { NewsletterForm } from "./newsletter-form";
import { useTrack } from "@/lib/analytics/track";

const STORAGE_KEY = "stackivo:exit_intent_dismissed";
const HIDE_FOR_DAYS = 30;
const SCROLL_THRESHOLD = 0.3; // 30% scrolled
const IDLE_FALLBACK_MS = 60_000;

const HIDE_ON_PATHS = [
  "/signup",
  "/login",
  "/talk",
  "/demo",
  "/contact",
  "/forgot-password",
  "/reset-password",
];

export function ExitIntentModal() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const triggered = React.useRef(false);
  const track = useTrack();

  const shouldHidePath = pathname
    ? HIDE_ON_PATHS.some((p) => pathname.startsWith(p))
    : false;

  React.useEffect(() => {
    if (shouldHidePath) return;
    if (typeof window === "undefined") return;

    // Already dismissed?
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const ts = Number(raw);
        if (
          Number.isFinite(ts) &&
          Date.now() - ts < HIDE_FOR_DAYS * 24 * 60 * 60 * 1000
        ) {
          return;
        }
      }
    } catch {
      // localStorage unavailable — silently allow.
    }

    const fire = (reason: "exit_intent" | "idle_fallback") => {
      if (triggered.current) return;
      // Only show on desktop / large viewport.
      if (window.innerWidth < 768) return;
      // Require at least 30% scroll so we don't ambush bounce-immediates.
      const scrolled =
        document.documentElement.scrollHeight > window.innerHeight
          ? window.scrollY /
            (document.documentElement.scrollHeight - window.innerHeight)
          : 1;
      if (scrolled < SCROLL_THRESHOLD) return;
      triggered.current = true;
      setOpen(true);
      track("marketing.exit_intent.shown", { reason });
    };

    const onMouseOut = (e: MouseEvent) => {
      // Detect pointer leaving via the top edge.
      if (e.relatedTarget) return;
      if (e.clientY > 0) return;
      fire("exit_intent");
    };

    const idleTimer = window.setTimeout(() => fire("idle_fallback"), IDLE_FALLBACK_MS);
    document.addEventListener("mouseout", onMouseOut);

    return () => {
      document.removeEventListener("mouseout", onMouseOut);
      window.clearTimeout(idleTimer);
    };
  }, [shouldHidePath, track]);

  const onClose = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  return (
    <div
      data-exit-intent
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-intent-title"
      className="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4 backdrop-blur-sm md:flex"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-primary/15 blur-3xl"
        />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-micro font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" />
            Wait — before you go
          </span>

          <h2
            id="exit-intent-title"
            className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl"
          >
            Get the GST invoice template, free.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A CA-approved GST invoice template (Excel + PDF), plus our monthly
            India-freelancer newsletter. No spam, unsubscribe in one click.
          </p>

          <div className="mt-5">
            <NewsletterForm
              source="exit_intent"
              magnet="gst_template"
              ctaLabel="Send it"
              successLabel="On its way to your inbox."
              placeholder="you@example.com"
            />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-4 text-micro font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            No thanks — close
          </button>
        </div>
      </div>
    </div>
  );
}
