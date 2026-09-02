import { HeroMockup } from "./hero-mockup";

/** A complete product view: the hero should prove there is a real workspace. */
export function HeroFlow() {
  return (
    <div className="relative mx-auto mt-12 w-full max-w-[1180px] pb-12 sm:mt-14 sm:pb-16" aria-hidden>
      <div className="absolute inset-x-[8%] bottom-0 h-24 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_34px_100px_-44px_hsl(224_45%_28%/0.48)]">
        <div className="flex h-11 items-center gap-1.5 border-b border-border bg-muted/45 px-4">
          <span className="h-1.5 w-1.5 rounded-full bg-border" />
          <span className="h-1.5 w-1.5 rounded-full bg-border" />
          <span className="h-1.5 w-1.5 rounded-full bg-border" />
          <span className="ml-2 font-mono text-micro text-muted-foreground">stackivo.me/dashboard</span>
        </div>
        <HeroMockup />
      </div>
    </div>
  );
}
