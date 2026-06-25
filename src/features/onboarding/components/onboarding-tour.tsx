"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from "lucide-react";
import { markOnboardingTourDoneAction } from "@/features/onboarding/actions";

/**
 * First-run guided spotlight tour.
 *
 * A dependency-free product walkthrough that dims the app, spotlights a real UI
 * element (sidebar nav item / AI trigger) and shows a tooltip with Back / Next /
 * Skip. When a step's target isn't on screen (e.g. the sidebar is hidden on
 * mobile) the step gracefully falls back to a centered card so the copy still
 * lands. Completion is remembered in localStorage so it only runs once.
 *
 * Anchors live on real elements via `data-tour="..."`:
 *   - sidebar links use their href (e.g. data-tour="/dashboard/clients")
 *   - the AI trigger uses data-tour="ai-assistant"
 */

const SESSION_KEY = "stackivo:onboarding-tour:shown";

interface TourStep {
  /** CSS selector of the element to spotlight. Omit for a centered step. */
  target?: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    title: "Welcome to Stackivo 👋",
    body: "Your whole client business — clients, invoices, contracts, time and payments — in one place. Here's a 30-second tour of where things live.",
  },
  {
    target: '[data-tour="/dashboard/clients"]',
    title: "Add your clients",
    body: "Start here. Add the people you work with — in India or abroad — each in their own currency. Foreign clients get export-ready invoicing automatically.",
  },
  {
    target: '[data-tour="/dashboard/invoices"]',
    title: "Send invoices that get paid",
    body: "Create GST-ready invoices, or zero-rated export invoices for overseas clients, and share a clean pay link. Reminders go out on their own.",
  },
  {
    target: '[data-tour="/dashboard/contracts"]',
    title: "Contracts & welcome docs",
    body: "Draft agreements and proposals clients can sign online, and onboard each one with a polished welcome document.",
  },
  {
    target: '[data-tour="/dashboard/pulse"]',
    title: "See the whole picture",
    body: "Pulse shows revenue, what's outstanding and your best clients — every currency consolidated to INR so the numbers always compare.",
  },
  {
    target: '[data-tour="ai-assistant"]',
    title: "Let AI do the typing",
    body: "Ask AI to draft an invoice, contract or welcome doc from a single sentence — like “Invoice Acme $1,200 for a landing page, due in 15 days.”",
  },
  {
    title: "You're all set 🎉",
    body: "The best first step is adding a client — everything else flows from there. You can always reach support from the Help section.",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingTour({ done = false }: { done?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [rect, setRect] = React.useState<Rect | null>(null);

  // Decide whether to auto-start: first time only, and only from the dashboard
  // home so we don't interrupt a user mid-task on a deeper page.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    // "Replay tour" links here with ?tour=1 — always honour that, regardless of
    // the saved completion flag or the current path.
    const forced = new URLSearchParams(window.location.search).get("tour") === "1";
    if (forced) {
      setStep(0);
      const t = window.setTimeout(() => setActive(true), 350);
      return () => window.clearTimeout(t);
    }
    if (done) return; // completed/dismissed on this account already
    let shown = false;
    try {
      shown = window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      shown = false;
    }
    if (shown) return; // don't re-trigger on client nav within this session
    if (pathname !== "/dashboard") return;
    // Let the shell paint first so target elements exist + are measurable.
    const t = window.setTimeout(() => setActive(true), 650);
    return () => window.clearTimeout(t);
  }, [pathname, done]);

  const finish = React.useCallback(() => {
    setActive(false);
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    // Persist per-account so it never shows again on any device.
    void markOnboardingTourDoneAction().catch(() => null);
    // If we were launched via ?tour=1 (replay), clean the URL.
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("tour") === "1"
    ) {
      router.replace("/dashboard");
    }
  }, [router]);

  const current = STEPS[step];

  // Measure the current step's target (if any), and keep it fresh on resize /
  // scroll. Falls back to a centered card when the target isn't present.
  React.useEffect(() => {
    if (!active || !current) return;
    if (!current.target) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(current.target!) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        setRect(null);
        return;
      }
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, current, step]);

  // Keyboard: Esc skips, Enter / → advances, ← goes back.
  React.useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight" || e.key === "Enter") {
        setStep((s) => (s >= STEPS.length - 1 ? s : s + 1));
        if (step >= STEPS.length - 1) finish();
      } else if (e.key === "ArrowLeft") {
        setStep((s) => Math.max(0, s - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, step, finish]);

  if (!active || !current) return null;

  const isLast = step === STEPS.length - 1;
  const pad = 6;

  // Tooltip placement: beside the target when there's room (sidebar items),
  // otherwise centered. Clamped to the viewport.
  const TOOLTIP_W = 320;
  let tipStyle: React.CSSProperties;
  if (rect) {
    const spaceRight = window.innerWidth - (rect.left + rect.width);
    const placeRight = spaceRight > TOOLTIP_W + 32;
    if (placeRight) {
      tipStyle = {
        top: Math.min(Math.max(12, rect.top - 8), window.innerHeight - 240),
        left: rect.left + rect.width + 16,
        width: TOOLTIP_W,
      };
    } else {
      // Place below, horizontally clamped.
      const left = Math.min(
        Math.max(12, rect.left),
        Math.max(12, window.innerWidth - TOOLTIP_W - 12),
      );
      tipStyle = { top: rect.top + rect.height + 14, left, width: TOOLTIP_W };
    }
  } else {
    tipStyle = {
      top: "50%",
      left: "50%",
      width: Math.min(TOOLTIP_W, typeof window !== "undefined" ? window.innerWidth - 32 : TOOLTIP_W),
      transform: "translate(-50%, -50%)",
    };
  }

  return (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true" aria-label="Product tour">
      {/* Dimmer + spotlight. When a target is measured we cut a hole with a huge
          ring shadow; otherwise the whole screen dims for a centered step. */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary/70 transition-all duration-200"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.62)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(2,6,23,0.62)]" />
      )}

      {/* Tooltip card */}
      <div
        className="absolute rounded-2xl border border-border bg-card p-4 shadow-2xl"
        style={tipStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <button
            type="button"
            onClick={finish}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3 className="mt-2 font-display text-[15px] font-semibold tracking-tight text-foreground">
          {current.title}
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          {current.body}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            {step + 1} / {STEPS.length}
          </span>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Next <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  finish();
                  router.push("/dashboard/clients?create=1");
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Check className="h-3.5 w-3.5" /> Add a client
              </button>
            )}
          </div>
        </div>

        {!isLast && (
          <button
            type="button"
            onClick={finish}
            className="mt-2 w-full text-center text-[11px] text-muted-foreground/80 hover:text-foreground"
          >
            Skip tour
          </button>
        )}
      </div>
    </div>
  );
}
