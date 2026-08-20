"use client";

import * as React from "react";
import Link from "next/link";
import { StackivoMark } from "@/components/brand/stackivo-logo";
import { UserNav } from "./user-nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { CommandPaletteTrigger } from "@/components/shared/command-palette";
import { NotificationsMenu } from "@/components/shared/notifications-menu";
import { Separator } from "@/components/ui/separator";
import { StackivoAiAssistant } from "@/features/ai-workflows/components/stackivo-ai-assistant";

interface TopNavProps {
  aiUser?: {
    name?: string | null;
    businessName?: string | null;
  };
}

export function TopNav({ aiUser }: TopNavProps) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/80 px-3 shadow-sm backdrop-blur-xl md:gap-3 md:px-6"
      style={{
        height: "calc(3.5rem + env(safe-area-inset-top, 0px))",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      {/* Mobile brand — mark + wordmark. No hamburger needed; navigation
          lives entirely in the bottom bar and its sheets. */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2 md:hidden"
        aria-label="Stackivo home"
      >
        <StackivoMark className="h-7 w-7" />
        <span className="text-sm font-semibold tracking-tight">Stackivo</span>
      </Link>

      {/* Desktop breadcrumbs */}
      <div className="hidden min-w-0 items-center gap-3 md:flex">
        <Breadcrumbs className="truncate" />
      </div>

      {/* Desktop command palette */}
      <div className="hidden flex-1 items-center justify-center px-2 md:flex">
        <CommandPaletteTrigger className="max-w-sm" />
      </div>

      {/* Flexible spacer on mobile so right cluster hugs the edge */}
      <div className="flex-1 md:hidden" />

      {/* Right cluster — theme toggle hidden on mobile (lives inside user menu) */}
      <div className="flex items-center gap-0.5 md:gap-1">
        <StackivoAiAssistant user={aiUser} />
        <NotificationsMenu />
        <span className="hidden md:inline-flex">
          <ThemeToggle />
        </span>
        <Separator orientation="vertical" className="mx-1 hidden h-5 md:block" />
        <UserNav />
      </div>
    </header>
  );
}
