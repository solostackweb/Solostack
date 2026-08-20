"use client";

/**
 * OnboardingCelebration
 *
 * Client component rendered on the /onboarding/done page.
 * On mount it fires a lightweight confetti burst using CSS-animated
 * particles (no third-party canvas library — framer-motion only).
 * After the burst settles it shows a "Your first 3 moves" quick-action
 * list to guide the user toward sending their first invoice.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import {
  FileText,
  Users,
  Bell,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Confetti particle colours
const COLOURS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
];

interface Particle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  colour: string;
  size: number;
  duration: number;
  delay: number;
}

function buildParticles(count = 48): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,          // vw %
    y: -10 - Math.random() * 10,     // start above viewport
    rotation: Math.random() * 720 - 360,
    colour: COLOURS[Math.floor(Math.random() * COLOURS.length)]!,
    size: 6 + Math.random() * 7,
    duration: 1.4 + Math.random() * 1.2,
    delay: Math.random() * 0.5,
  }));
}

const QUICK_ACTIONS = [
  {
    icon: FileText,
    title: "Send your first invoice",
    description: "Takes 2 minutes. Clients can pay directly from the link.",
    href: "/dashboard/invoices/new",
    cta: "Create invoice",
    highlight: true,
  },
  {
    icon: Users,
    title: "Add your clients",
    description: "Import a CSV or add them one by one — as many as you need.",
    href: "/dashboard/clients?create=1",
    cta: "Add client",
    highlight: false,
  },
  {
    icon: Bell,
    title: "Turn on overdue reminders",
    description: "Stackivo auto-emails your client at Day+1, 7 and 14 overdue.",
    href: "/dashboard/settings/notifications",
    cta: "Check settings",
    highlight: false,
  },
];

export function OnboardingCelebration() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    setParticles(buildParticles(52));
    const t = setTimeout(() => setShowActions(true), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {/* Confetti layer — fixed, pointer-events-none so it doesn't block clicks */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
        style={{ zIndex: 50 }}
      >
        <AnimatePresence>
          {particles.map((p) => (
            <motion.span
              key={p.id}
              initial={{
                left: `${p.x}vw`,
                top: `${p.y}vh`,
                rotate: 0,
                opacity: 1,
              }}
              animate={{
                top: "110vh",
                rotate: p.rotation,
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: "easeIn",
              }}
              style={{
                position: "absolute",
                width: p.size,
                height: p.size * 0.45,
                borderRadius: 2,
                background: p.colour,
              }}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Quick actions — animate in after confetti settles */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mt-6 w-full"
          >
            <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Your first 3 moves
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`group flex flex-col gap-3 rounded-lg border p-4 transition-all hover:shadow-md ${
                    action.highlight
                      ? "border-primary/30 bg-primary/5 hover:border-primary/50"
                      : "bg-card hover:border-foreground/20"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      action.highlight
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <action.icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-semibold ${action.highlight ? "text-primary" : ""}`}
                    >
                      {action.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground/60 transition-colors group-hover:text-foreground">
                    {action.cta} <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Standalone "first invoice sent" celebration — shown inline on the
 * invoice detail page after the first ever send. Pass `show` based on
 * whether `lifetimeInvoicesSent === 1`.
 */
export function FirstInvoiceCelebration({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-start gap-3 rounded-lg border border-success-subtle bg-success-subtle p-4"
    >
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-strong" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-success-strong">
          First invoice sent — great start!
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Your client will receive a payment link. Stackivo auto-sends a
          reminder at Day+1, 7 and 14 if it goes unpaid.
        </p>
      </div>
      <Button asChild size="sm" variant="outline" className="shrink-0">
        <Link href="/dashboard/clients?create=1">
          Add another client <ArrowRight className="ml-1 h-3 w-3" />
        </Link>
      </Button>
    </motion.div>
  );
}
