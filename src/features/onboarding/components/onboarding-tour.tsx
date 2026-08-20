"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  FileSignature,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Settings,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { markOnboardingTourDoneAction } from "@/features/onboarding/actions";

/**
 * First-run guided spotlight tour.
 *
 * Dependency-free product walkthrough that dims the app, spotlights a real UI
 * element (sidebar nav item / AI trigger) and shows an animated tooltip with
 * Back / Next / Skip. The whole overlay is portaled to `document.body` so it
 * escapes the dashboard's transformed `animate-page-enter` container — without
 * that, `position: fixed` would resolve against the (tall) page content instead
 * of the viewport, pushing the card below the fold.
 *
 * When a step's target isn't on screen (e.g. the sidebar is hidden on mobile)
 * the step gracefully falls back to a centered card. Completion is persisted
 * per-account (DB) + guarded per-session.
 *
 * Anchors live on real elements via `data-tour="..."`:
 *   - sidebar links use their href (e.g. data-tour="/dashboard/clients")
 *   - the AI trigger uses data-tour="ai-assistant"
 */

const SESSION_KEY = "stackivo:onboarding-tour:shown";

interface TourStep {
  /** CSS selector of the element to spotlight. Omit for a centered step. */
  target?: string;
  icon: LucideIcon;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    icon: Sparkles,
    title: "Welcome to Stackivo \u{1F44B}",
    body: "This is your command center — clients, invoices, contracts, time and payments, all in one place. Here's a quick 60-second tour of where everything lives.",
  },
  {
    target: '[data-tour="/dashboard"]',
    icon: LayoutDashboard,
    title: "Your dashboard",
    body: "Every time you log in you land here: cash collected, what's outstanding or overdue, active work and your revenue trend — the health of your business at a glance.",
  },
  {
    target: '[data-tour="/dashboard/clients"]',
    icon: Users,
    title: "1. Add your clients",
    body: "Start here. Add the people you work with — Indian or international. Each client has their own currency, so foreign clients get correct, export-ready invoices automatically.",
  },
  {
    target: '[data-tour="/dashboard/projects"]',
    icon: FolderKanban,
    title: "2. Organise work into projects",
    body: "Group work under a project per client to keep scope, time and invoices tidy — and to see exactly what each engagement is earning you.",
  },
  {
    target: '[data-tour="/dashboard/invoices"]',
    icon: FileText,
    title: "3. Invoice and get paid",
    body: "Create GST-ready invoices, or zero-rated export invoices for overseas clients, and share a clean pay link. Due-soon and overdue reminders go out automatically.",
  },
  {
    target: '[data-tour="/dashboard/contracts"]',
    icon: FileSignature,
    title: "4. Send contracts to sign",
    body: "Draft agreements and proposals your clients can review and sign online — legally compliant, with a signed PDF saved for your records.",
  },
  {
    target: '[data-tour="/dashboard/welcome"]',
    icon: BookOpen,
    title: "5. Onboard with welcome docs",
    body: "Kick off every engagement with a polished welcome document — scope, process and payment terms — so projects start clear and stay clear.",
  },
  {
    target: '[data-tour="/dashboard/time"]',
    icon: Clock,
    title: "6. Track billable time",
    body: "Log hours against a project and turn unbilled time into an invoice in one click — nothing you've worked on slips through.",
  },
  {
    target: '[data-tour="/dashboard/pulse"]',
    icon: Activity,
    title: "7. See the whole picture",
    body: "Pulse shows revenue, receivables, your best clients and aging — every currency consolidated to INR so the numbers always compare. Export GST-ready reports anytime.",
  },
  {
    target: '[data-tour="/dashboard/settings"]',
    icon: Settings,
    title: "Connect how you get paid",
    body: "In Settings, add your UPI for Indian clients and connect Wise, PayPal, Payoneer or a bank account for international ones. These show on your invoices — Stackivo never holds the money.",
  },
  {
    target: '[data-tour="ai-assistant"]',
    icon: Sparkles,
    title: "Meet Ivo, your AI assistant",
    body: "Tap Ask Ivo and describe what you need in plain English — “Invoice Acme $1,200 for a landing page, due in 15 days” — and Ivo drafts the invoice, contract or welcome doc for you.",
  },
  {
    icon: Check,
    title: "You're all set \u{1F389}",
    body: "The best first step is adding a client — everything else flows from there. You can replay this tour anytime from Help & support.",
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
  const [mounted, setMounted] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [rect, setRect] = React.useState<Rect | null>(null);

  React.useEffect(() => setMounted(true), []);

  // Auto-start: first time only (per account + per session), and only from the
  // dashboard home so we never interrupt a deeper task. ?tour=1 forces a replay.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const forced = new URLSearchParams(window.location.search).get("tour") === "1";
    if (forced) {
      setStep(0);
      const t = window.setTimeout(() => setActive(true), 300);
      return () => window.clearTimeout(t);
    }
    if (done) return;
    let shown = false;
    try {
      shown = window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      shown = false;
    }
    if (shown) return;
    if (pathname !== "/dashboard") return;
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
    void markOnboardingTourDoneAction().catch(() => null);
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("tour") === "1"
    ) {
      router.replace("/dashboard");
    }
  }, [router]);

  const goNext = React.useCallback(() => {
    setStep((s) => {
      if (s >= STEPS.length - 1) {
        finish();
        return s;
      }
      return s + 1;
    });
  }, [finish]);
  const goBack = React.useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  const current = STEPS[step];

  // Measure the current target (after scrolling it into view) and keep it fresh
  // on resize / scroll. Falls back to a centered card when absent.
  React.useEffect(() => {
    if (!active || !current) return;
    if (!current.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(current.target) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    try {
      el.scrollIntoView({ block: "center", inline: "nearest" });
    } catch {
      /* ignore */
    }
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        setRect(null);
        return;
      }
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const raf = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, current, step]);

  // Keyboard: Esc skips, Enter / -> advances, <- goes back.
  React.useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight" || e.key === "Enter") goNext();
      else if (e.key === "ArrowLeft") goBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish, goNext, goBack]);

  if (!mounted || !active || !current) return null;

  const isLast = step === STEPS.length - 1;
  const pad = 6;
  const Icon = current.icon;

  // Tooltip placement: beside the target when there's room, else below, else
  // above, else centered. Clamped to the viewport (correct because we portal to
  // body — no transformed ancestor to skew `position: fixed`).
  const TOOLTIP_W = 340;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let tipStyle: React.CSSProperties;
  if (rect) {
    const spaceRight = vw - (rect.left + rect.width);
    const spaceBelow = vh - (rect.top + rect.height);
    if (spaceRight > TOOLTIP_W + 32) {
      tipStyle = {
        top: Math.min(Math.max(16, rect.top - 8), vh - 300),
        left: rect.left + rect.width + 16,
        width: TOOLTIP_W,
      };
    } else if (spaceBelow > 260) {
      tipStyle = {
        top: rect.top + rect.height + 14,
        left: Math.min(Math.max(16, rect.left), Math.max(16, vw - TOOLTIP_W - 16)),
        width: TOOLTIP_W,
      };
    } else {
      tipStyle = {
        top: Math.max(16, rect.top - 240),
        left: Math.min(Math.max(16, rect.left), Math.max(16, vw - TOOLTIP_W - 16)),
        width: TOOLTIP_W,
      };
    }
  } else {
    tipStyle = {
      top: "50%",
      left: "50%",
      width: Math.min(TOOLTIP_W, vw - 32),
      transform: "translate(-50%, -50%)",
    };
  }

  const overlay = (
    <div
      className="fixed inset-0 z-[10000] animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Product tour"
      onClick={(e) => {
        if (e.target === e.currentTarget) goNext();
      }}
    >
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-all duration-300 ease-out"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.55)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(2,6,23,0.55)] backdrop-blur-[1px]" />
      )}

      <div
        key={step}
        className="absolute rounded-2xl border border-border bg-card p-4 shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-1 duration-200"
        style={tipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <button
            type="button"
            onClick={finish}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3 className="mt-3 font-display text-base font-semibold tracking-tight text-foreground">
          {current.title}
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {current.body}
        </p>

        <div className="mt-4 flex items-center gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={
                i === step
                  ? "h-1.5 w-5 rounded-full bg-primary transition-all"
                  : "h-1.5 w-1.5 rounded-full bg-muted-foreground/25 transition-all"
              }
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-micro font-medium text-muted-foreground">
            {step + 1} of {STEPS.length}
          </span>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
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
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
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
            className="mt-2 w-full text-center text-xs text-muted-foreground/80 transition-colors hover:text-foreground"
          >
            Skip tour
          </button>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
