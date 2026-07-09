/**
 * /admin/settings - platform-wide kill switches and config.
 *
 * Renders all rows currently in `platform_settings`. The "Known
 * settings" panel lists keys we expect to see - clicking creates the
 * row if missing.
 *
 * The full list of supported keys evolves with the app; documenting
 * them inline keeps the UI honest.
 */

import { listPlatformSettings } from "@/features/admin/queries";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/kit";
import { SettingRow } from "@/components/admin/setting-row";
import { SlackAlertSection } from "@/components/admin/slack-alert-section";

export const dynamic = "force-dynamic";

interface KnownSetting {
  key: string;
  hint: string;
  defaultValue: unknown;
}

const KNOWN_SETTINGS: KnownSetting[] = [
  {
    key: "maintenance_mode",
    hint: "When true, marketing pages render a banner. Set to false in normal operation.",
    defaultValue: false,
  },
  {
    key: "public_signups_enabled",
    hint: "Toggle public signup. Disable temporarily during incidents.",
    defaultValue: true,
  },
  {
    key: "email_live_mode_override",
    hint: "Force-disable outbound email even when env says live (kill switch). null = use env default.",
    defaultValue: null,
  },
];

export default async function AdminSettingsPage() {
  const existing = await listPlatformSettings();
  const existingByKey = new Map(existing.map((r) => [r.key, r]));

  // Merge known + existing, preferring existing values.
  const rows = KNOWN_SETTINGS.map((k) => {
    const row = existingByKey.get(k.key);
    return {
      key: k.key,
      value: row?.value ?? k.defaultValue,
      updatedAt: row?.updated_at,
      hint: k.hint,
    };
  });

  // Surface any keys the founder added ad-hoc that we didn't document.
  const extras = existing
    .filter((r) => !KNOWN_SETTINGS.some((k) => k.key === r.key))
    .map((r) => ({
      key: r.key,
      value: r.value,
      updatedAt: r.updated_at,
      hint: "Custom / undocumented key.",
    }));

  // Slack webhook status - never expose the full URL to the client.
  const rawWebhook = process.env.OPS_SLACK_WEBHOOK_URL?.trim() ?? null;
  const slackConfigured = !!rawWebhook;
  const slackPreview = rawWebhook ? rawWebhook.slice(0, 40) : null;

  return (
    <AdminSection>
      <AdminPageHeader
        title="Settings"
        subtitle="Platform-wide kill switches & config. Service-role only - every change audited."
      />

      {/* ── Integrations ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Integrations
        </h2>
        <SlackAlertSection
          configured={slackConfigured}
          webhookPreview={slackPreview}
        />
      </div>

      {/* ── Platform settings ────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Platform Settings
        </h2>
        <ul className="space-y-2">
          {rows.map((r) => (
            <SettingRow
              key={r.key}
              settingKey={r.key}
              value={r.value}
              updatedAt={r.updatedAt}
              hint={r.hint}
            />
          ))}
          {extras.map((r) => (
            <SettingRow
              key={r.key}
              settingKey={r.key}
              value={r.value}
              updatedAt={r.updatedAt}
              hint={r.hint}
            />
          ))}
        </ul>
      </div>
    </AdminSection>
  );
}
