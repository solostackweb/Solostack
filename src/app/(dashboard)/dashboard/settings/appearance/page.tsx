"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SettingsSection,
  SettingsField,
  SettingsPageHeader,
  SettingsToggleRow,
} from "@/features/settings/components/settings-section";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

type SidebarPref = "auto" | "expanded" | "collapsed";

/** Read a boolean flag from localStorage, with a fallback. */
function readBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const v = localStorage.getItem(key);
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme();

  // ── Density ───────────────────────────────────────────────────────────────
  const [density, setDensity] = React.useState<"compact" | "comfortable">("comfortable");

  // ── Sidebar behaviour ─────────────────────────────────────────────────────
  const [sidebarPref, setSidebarPref] = React.useState<SidebarPref>("auto");

  // ── Tooltips ──────────────────────────────────────────────────────────────
  const [tooltips, setTooltips] = React.useState(true);

  // ── Reduced motion ────────────────────────────────────────────────────────
  const [reducedMotion, setReducedMotion] = React.useState(false);

  // Hydrate all prefs from localStorage on mount
  React.useEffect(() => {
    const storedDensity = localStorage.getItem("stackivo:density");
    if (storedDensity === "compact" || storedDensity === "comfortable") {
      setDensity(storedDensity);
      document.documentElement.setAttribute("data-density", storedDensity);
    }

    const storedSidebar = localStorage.getItem("stackivo:sidebar-behaviour") as SidebarPref | null;
    if (storedSidebar === "auto" || storedSidebar === "expanded" || storedSidebar === "collapsed") {
      setSidebarPref(storedSidebar);
    }

    const storedTooltips = readBool("stackivo:tooltips", true);
    setTooltips(storedTooltips);
    document.documentElement.setAttribute("data-tooltips", String(storedTooltips));

    // Seed from OS preference if no override is stored
    const storedReduced = localStorage.getItem("stackivo:reduced-motion");
    const osReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const effectiveReduced = storedReduced !== null ? storedReduced === "true" : osReduced;
    setReducedMotion(effectiveReduced);
    document.documentElement.setAttribute("data-reduced-motion", String(effectiveReduced));
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleDensityChange = React.useCallback((value: "compact" | "comfortable") => {
    setDensity(value);
    localStorage.setItem("stackivo:density", value);
    document.documentElement.setAttribute("data-density", value);
  }, []);

  const handleSidebarChange = React.useCallback((value: SidebarPref) => {
    setSidebarPref(value);
    localStorage.setItem("stackivo:sidebar-behaviour", value);
    // Apply immediately for the current session
    // The sidebar reads this key on mount; a full page refresh will pick it up.
    // For immediate effect without a refresh, dispatch a storage event.
    window.dispatchEvent(new StorageEvent("storage", {
      key: "stackivo:sidebar-behaviour",
      newValue: value,
    }));
  }, []);

  const handleTooltipsChange = React.useCallback((checked: boolean) => {
    setTooltips(checked);
    localStorage.setItem("stackivo:tooltips", String(checked));
    document.documentElement.setAttribute("data-tooltips", String(checked));
  }, []);

  const handleReducedMotionChange = React.useCallback((checked: boolean) => {
    setReducedMotion(checked);
    localStorage.setItem("stackivo:reduced-motion", String(checked));
    document.documentElement.setAttribute("data-reduced-motion", String(checked));
  }, []);

  const handleSaveWorkspace = React.useCallback(() => {
    // All values already persisted on change; this just acknowledges the save.
    toast.success("Workspace preferences saved");
  }, []);

  return (
    <>
      <SettingsPageHeader
        title="Appearance"
        description="Customize how Stackivo looks and feels on your devices."
      />

      <SettingsSection
        title="Theme"
        description="Sync with your device or pick a specific mode."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {THEMES.map((t) => {
            const active = (theme ?? "system") === t.value;
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTheme(t.value)}
                aria-pressed={active}
                className={cn(
                  "group flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <ThemePreview variant={t.value} />
                <div className="flex w-full items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </span>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </div>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Density"
        description="Tighten up spacing across tables and lists."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                value: "comfortable",
                label: "Comfortable",
                hint: "Default spacing, easier to scan",
              },
              {
                value: "compact",
                label: "Compact",
                hint: "More rows on screen, denser tables",
              },
            ] as const
          ).map((opt) => {
            const active = density === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleDensityChange(opt.value)}
                aria-pressed={active}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{opt.label}</p>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {opt.hint}
                </p>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Workspace preferences"
        description="Smaller toggles that change how Stackivo behaves day-to-day."
        onSave={handleSaveWorkspace}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <SettingsField label="Interface language">
            <Select value="en" disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              More languages coming soon.
            </p>
          </SettingsField>
          <SettingsField label="Sidebar behaviour">
            <Select value={sidebarPref} onValueChange={(v) => handleSidebarChange(v as SidebarPref)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-collapse on small screens</SelectItem>
                <SelectItem value="expanded">Always expanded</SelectItem>
                <SelectItem value="collapsed">Always collapsed</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
        </div>

        <SettingsToggleRow
          label="Show tooltips on hover"
          description="Helpful hints for keyboard shortcuts and icon-only buttons."
        >
          <Switch checked={tooltips} onCheckedChange={handleTooltipsChange} />
        </SettingsToggleRow>
        <SettingsToggleRow
          label="Enable reduced motion"
          description="Minimise animations — overrides your OS setting within Stackivo."
        >
          <Switch checked={reducedMotion} onCheckedChange={handleReducedMotionChange} />
        </SettingsToggleRow>
      </SettingsSection>
    </>
  );
}

/** Tiny theme "swatch" used on the theme picker tiles. */
function ThemePreview({ variant }: { variant: "light" | "dark" | "system" }) {
  const styles =
    variant === "light"
      ? { bg: "bg-white", fg: "bg-muted", accent: "bg-foreground" }
      : variant === "dark"
        ? { bg: "bg-foreground", fg: "bg-foreground", accent: "bg-white" }
        : { bg: "bg-gradient-to-br from-white to-slate-900", fg: "bg-foreground", accent: "bg-primary" };

  return (
    <div
      className={cn(
        "flex h-16 w-full items-end gap-1.5 rounded-lg border p-2",
        styles.bg,
      )}
    >
      <div className={cn("h-full w-1/3 rounded", styles.fg)} />
      <div className="flex flex-1 flex-col gap-1">
        <div className={cn("h-2 w-3/4 rounded", styles.fg)} />
        <div className={cn("h-2 w-1/2 rounded", styles.fg)} />
        <div className={cn("mt-auto h-3 w-14 rounded", styles.accent)} />
      </div>
    </div>
  );
}
