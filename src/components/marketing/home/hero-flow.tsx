import { HeroMockup } from "./hero-mockup";
import { HeroClientMockup, HeroInvoiceMockup } from "./hero-supporting-mockups";

/** Three complete product views arranged as one connected workspace composition. */
export function HeroFlow() {
  return (
    <div className="relative mx-auto mt-12 w-full max-w-[1280px] pb-12 sm:mt-14 sm:pb-20" aria-hidden>
      <div className="absolute inset-x-[12%] bottom-0 h-28 rounded-full bg-primary/15 blur-3xl" />

      <div className="grid gap-4 sm:grid-cols-2 lg:relative lg:h-[510px] lg:grid-cols-none">
        <ProductWindow
          address="stackivo.me/clients/nexa-labs"
          className="order-2 sm:order-none lg:absolute lg:left-0 lg:top-20 lg:z-10 lg:w-[39%] lg:-rotate-[2.5deg]"
        >
          <HeroClientMockup />
        </ProductWindow>

        <ProductWindow
          address="stackivo.me/dashboard"
          className="order-1 sm:col-span-2 lg:absolute lg:left-1/2 lg:top-0 lg:z-20 lg:w-[64%] lg:-translate-x-1/2"
          primary
        >
          <HeroMockup />
        </ProductWindow>

        <ProductWindow
          address="stackivo.me/invoices/INV-2026-042"
          className="order-3 sm:order-none lg:absolute lg:right-0 lg:top-24 lg:z-10 lg:w-[39%] lg:rotate-[2.5deg]"
        >
          <HeroInvoiceMockup />
        </ProductWindow>
      </div>
    </div>
  );
}

function ProductWindow({
  address,
  className,
  primary,
  children,
}: {
  address: string;
  className?: string;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-border bg-card ${
        primary
          ? "shadow-[0_34px_100px_-44px_hsl(224_45%_28%/0.52)]"
          : "shadow-[0_24px_70px_-42px_hsl(224_45%_28%/0.5)]"
      } ${className ?? ""}`}
    >
      <div className="flex h-10 items-center gap-1.5 border-b border-border bg-muted/50 px-3.5">
        <span className="h-1.5 w-1.5 rounded-full bg-border" />
        <span className="h-1.5 w-1.5 rounded-full bg-border" />
        <span className="h-1.5 w-1.5 rounded-full bg-border" />
        <span className="ml-2 truncate font-mono text-micro text-muted-foreground">{address}</span>
      </div>
      {children}
    </div>
  );
}
