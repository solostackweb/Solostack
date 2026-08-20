import Link from "next/link";
import { logoutAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { StackivoLogo } from "@/components/brand/stackivo-logo";

/**
 * Onboarding layout.
 *
 * Calm, focused, slightly elevated visual treatment. Subtle radial glow
 * sits at the top so the canvas doesn't feel sterile.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate flex min-h-screen flex-col bg-muted/30">
      {/* Ambient gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[500px] bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,hsl(var(--primary)/0.14),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] [background-size:56px_56px] opacity-[0.16] [mask-image:radial-gradient(ellipse_60%_40%_at_50%_10%,#000,transparent_82%)]"
      />

      <header
        className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/70 px-4 backdrop-blur-xl sm:px-6"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <Link
          href="/"
          className="inline-flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Stackivo home"
        >
          <StackivoLogo className="[&>span:first-child]:h-9 [&>span:first-child]:w-9 [&>span:last-child]:text-base" />
        </Link>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm" className="font-medium">
            Sign out
          </Button>
        </form>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
    </div>
  );
}
