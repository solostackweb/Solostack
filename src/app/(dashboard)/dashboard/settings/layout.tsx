import * as React from "react";
import {
  SettingsNavDesktop,
  SettingsNavMobile,
} from "@/features/settings/components/settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-1.5 border-b pb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-2xl sm:leading-tight">
          Settings
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Manage your account, workspace, and preferences.
        </p>
      </div>

      <SettingsNavMobile />

      <div className="flex gap-10">
        <SettingsNavDesktop />
        <div className="min-w-0 flex-1 space-y-6 pb-16">{children}</div>
      </div>
    </div>
  );
}
