import {
  BarChart3,
  BellRing,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import { Section, SectionHeading } from "../section";
import { Reveal, StaggerItem, StaggerReveal } from "../motion";
import { cn } from "@/lib/utils";

/**
 * Core capabilities. The quiet details — analytics, onboarding documents,
 * reminders, isolation. GST used to be the featured card here; in v2 it has
 * its own section (`tax-section.tsx`) and owns the #gst anchor, so this file
 * no longer carries a duplicate.
 */
export function CapabilitiesSection() {
  return (
    <Section id="capabilities" size="ultra" className="relative border-y bg-muted/30">
      <Reveal>
        <SectionHeading
          eyebrow="Capabilities"
          title="Small details, handled properly."
          subtitle="The unglamorous parts of running a business — tax, onboarding, reminders, reporting — are exactly where Stackivo does the most work for you."
        />
      </Reveal>

      <StaggerReveal className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3">
        <StaggerItem>
          <BentoCard
            icon={BarChart3}
            title="Pulse analytics"
            body="Outstanding vs collected, your best clients, monthly revenue trends — the numbers that actually matter, on one dashboard."
            className="h-full"
          >
            <div className="mt-5 flex h-16 items-end gap-1.5" aria-hidden>
              {[40, 60, 45, 75, 58, 85, 70, 100].map((h, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-t",
                    i === 7 ? "bg-primary" : "bg-primary/20",
                  )}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </BentoCard>
        </StaggerItem>

        <StaggerItem>
          <BentoCard
            icon={BookOpen}
            title="Welcome documents"
            body="Onboard every client with a polished welcome doc — scope, process, payment terms — so projects start clear and stay clear."
            className="h-full"
          />
        </StaggerItem>

        <StaggerItem>
          <BentoCard
            icon={BellRing}
            title="Polite, persistent reminders"
            body="Stackivo follows up on overdue invoices for you — friendly, professional, and automatic. You stay the good cop."
            className="h-full"
          />
        </StaggerItem>

        <StaggerItem>
          <BentoCard
            icon={ShieldCheck}
            title="Your data, isolated"
            body="Every workspace is isolated with row-level security and backed up daily. Export anytime — your data is always yours."
            className="h-full"
          />
        </StaggerItem>
      </StaggerReveal>
    </Section>
  );
}

function BentoCard({
  icon: Icon,
  title,
  body,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "card-lift group rounded-2xl border border-border/80 bg-card p-6 transition-shadow sm:p-7",
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}
