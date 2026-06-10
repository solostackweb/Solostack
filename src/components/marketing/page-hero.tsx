import { cn } from "@/lib/utils";
import { SectionEyebrow } from "./section";

/**
 * Shared compact hero band for inner marketing pages (blog, tools, pricing,
 * docs). Consistent gradient + grid background, tight vertical rhythm, and
 * a slot for page-specific extras (stats, links, search).
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <section className={cn("relative isolate overflow-hidden border-b border-border/60", className)}>
      {/* Background — same family as the homepage hero */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-70%] h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-primary/[0.08] blur-[110px]" />
        <div
          className="absolute inset-0 opacity-[0.3] [mask-image:radial-gradient(ellipse_65%_90%_at_50%_0%,black,transparent)]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border)/0.7) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)/0.7) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>

      <div
        className={cn(
          "mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-5 py-12 sm:px-8 sm:py-14 lg:px-12 lg:py-16 2xl:px-16",
          align === "center" ? "items-center text-center" : "items-start text-left",
        )}
      >
        {eyebrow ? <SectionEyebrow>{eyebrow}</SectionEyebrow> : null}
        <h1 className="max-w-3xl text-balance font-display text-[32px] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground sm:text-[42px] lg:text-5xl">
          {title}
        </h1>
        {subtitle ? (
          <p className={cn("max-w-2xl text-pretty text-[15px] leading-[1.7] text-muted-foreground sm:text-[17px]", align === "center" && "mx-auto")}>
            {subtitle}
          </p>
        ) : null}
        {children}
      </div>
    </section>
  );
}
