"use client";

/**
 * HelpTabs — two-tab switcher on /help.
 *   - "Help"       → FAQ + quick contact methods (default on load)
 *   - "Contact us" → your tickets + the detailed contact form
 */

import * as React from "react";
import { BookOpen, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "help" | "contact";

export function HelpTabs({
  help,
  contact,
}: {
  help: React.ReactNode;
  contact: React.ReactNode;
}) {
  const [tab, setTab] = React.useState<Tab>("help");

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-border/60">
        <TabButton active={tab === "help"} onClick={() => setTab("help")} icon={BookOpen}>
          Help
        </TabButton>
        <TabButton
          active={tab === "contact"}
          onClick={() => setTab("contact")}
          icon={MessageSquarePlus}
        >
          Contact us
        </TabButton>
      </div>

      <div>{tab === "help" ? help : contact}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "-mb-px border border-b-background bg-background text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
