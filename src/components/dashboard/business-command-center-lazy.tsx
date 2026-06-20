"use client";

import dynamic from "next/dynamic";
import type { BusinessCommandCenterProps } from "./business-command-center";

const BusinessCommandCenter = dynamic(
  () => import("./business-command-center").then((m) => m.BusinessCommandCenter),
  {
    ssr: false,
    loading: () => (
      <section
        className="min-h-[560px] animate-pulse rounded-xl border border-border/70 bg-card"
        aria-hidden
      />
    ),
  },
);

export function BusinessCommandCenterLazy(props: BusinessCommandCenterProps) {
  return <BusinessCommandCenter {...props} />;
}
