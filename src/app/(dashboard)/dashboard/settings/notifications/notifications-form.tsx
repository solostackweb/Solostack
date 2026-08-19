"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
import { useProfile } from "@/features/profile/context";
import { updateNotificationPreferences } from "@/features/profile/actions";
import type { NotificationPreferencesInput } from "@/features/profile/schemas";

const EMAIL_NOTIFS: Array<{
  key: keyof Pick<
    NotificationPreferencesInput,
    | "emailInvoicePaid"
    | "emailInvoiceViewed"
    | "emailInvoiceOverdue"
    | "emailClientCreated"
    | "emailWeeklyDigest"
    | "emailProductUpdates"
  >;
  label: string;
  description: string;
}> = [
  {
    key: "emailInvoicePaid",
    label: "Invoice paid",
    description: "When a client fully pays an invoice.",
  },
  {
    key: "emailInvoiceViewed",
    label: "Invoice viewed",
    description: "When a client opens an invoice you sent.",
  },
  {
    key: "emailInvoiceOverdue",
    label: "Invoice overdue",
    description: "Digest of invoices that have passed their due date.",
  },
  {
    key: "emailClientCreated",
    label: "Client created",
    description: "When a new client is added to your workspace.",
  },
  {
    key: "emailWeeklyDigest",
    label: "Weekly digest",
    description: "A Monday summary of revenue, invoices, and activity.",
  },
  {
    key: "emailProductUpdates",
    label: "Product updates",
    description: "Major releases, billing changes, and important notices.",
  },
];

const IN_APP_NOTIFS: Array<{
  key: keyof Pick<
    NotificationPreferencesInput,
    "inAppPayments" | "inAppClientActivity" | "inAppContracts"
  >;
  label: string;
  description: string;
}> = [
  {
    key: "inAppPayments",
    label: "Payment events",
    description: "Invoice paid, failed payment, refund, and billing events.",
  },
  {
    key: "inAppClientActivity",
    label: "Client activity",
    description: "Client opens an invoice, views a document, or creates activity.",
  },
  {
    key: "inAppContracts",
    label: "Contracts",
    description: "Contract sent, viewed, signed, declined, or expired.",
  },
];

export function NotificationSettingsPage() {
  const { profile, setProfile } = useProfile();
  const prefs = profile?.notificationPreferences;

  const form = useForm<NotificationPreferencesInput>({
    defaultValues: {
      emailInvoicePaid: prefs?.emailInvoicePaid ?? true,
      emailInvoiceViewed: prefs?.emailInvoiceViewed ?? true,
      emailInvoiceOverdue: prefs?.emailInvoiceOverdue ?? true,
      emailClientCreated: prefs?.emailClientCreated ?? false,
      emailWeeklyDigest: prefs?.emailWeeklyDigest ?? true,
      emailProductUpdates: prefs?.emailProductUpdates ?? false,
      inAppPayments: prefs?.inAppPayments ?? true,
      inAppClientActivity: prefs?.inAppClientActivity ?? true,
      inAppContracts: prefs?.inAppContracts ?? true,
      notificationEmail:
        prefs?.notificationEmail ||
        profile?.businessEmail ||
        profile?.email ||
        "",
      quietHours: prefs?.quietHours ?? "none",
      batchNonUrgent: prefs?.batchNonUrgent ?? true,
    },
  });

  React.useEffect(() => {
    form.reset({
      emailInvoicePaid: prefs?.emailInvoicePaid ?? true,
      emailInvoiceViewed: prefs?.emailInvoiceViewed ?? true,
      emailInvoiceOverdue: prefs?.emailInvoiceOverdue ?? true,
      emailClientCreated: prefs?.emailClientCreated ?? false,
      emailWeeklyDigest: prefs?.emailWeeklyDigest ?? true,
      emailProductUpdates: prefs?.emailProductUpdates ?? false,
      inAppPayments: prefs?.inAppPayments ?? true,
      inAppClientActivity: prefs?.inAppClientActivity ?? true,
      inAppContracts: prefs?.inAppContracts ?? true,
      notificationEmail:
        prefs?.notificationEmail ||
        profile?.businessEmail ||
        profile?.email ||
        "",
      quietHours: prefs?.quietHours ?? "none",
      batchNonUrgent: prefs?.batchNonUrgent ?? true,
    });
  }, [form, prefs, profile?.businessEmail, profile?.email]);

  const { errors, isDirty, isSubmitting } = form.formState;

  const save = form.handleSubmit(async (values) => {
    const res = await updateNotificationPreferences(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setProfile(res.data?.profile ?? null);
    form.reset(values);
    toast.success(res.message ?? "Notification preferences saved");
  });

  return (
    <>
      <SettingsPageHeader
        title="Notifications"
        description="Control the real notification events Stackivo stores and sends."
      />

      <SettingsSection
        title="Email notifications"
        description={`Sent to ${form.watch("notificationEmail") || "your account email"}.`}
        onSave={save}
        isDirty={isDirty}
        isSubmitting={isSubmitting}
      >
        <div>
          {EMAIL_NOTIFS.map((n) => (
            <SettingsToggleRow
              key={n.key}
              label={n.label}
              description={n.description}
            >
              <Switch
                checked={Boolean(form.watch(n.key))}
                onCheckedChange={(value) =>
                  form.setValue(n.key, value, { shouldDirty: true })
                }
              />
            </SettingsToggleRow>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="In-app notifications"
        description="Events that appear in the notification center and top navigation bell."
        onSave={save}
        isDirty={isDirty}
        isSubmitting={isSubmitting}
      >
        <div>
          {IN_APP_NOTIFS.map((n) => (
            <SettingsToggleRow
              key={n.key}
              label={n.label}
              description={n.description}
            >
              <Switch
                checked={Boolean(form.watch(n.key))}
                onCheckedChange={(value) =>
                  form.setValue(n.key, value, { shouldDirty: true })
                }
              />
            </SettingsToggleRow>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Delivery"
        description="Where notifications are sent and when low-priority messages are batched."
        onSave={save}
        isDirty={isDirty}
        isSubmitting={isSubmitting}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <SettingsField
            label="Notification email"
            error={errors.notificationEmail?.message}
          >
            <Input type="email" {...form.register("notificationEmail")} />
          </SettingsField>
          <SettingsField label="Quiet hours">
            <Select
              value={form.watch("quietHours")}
              onValueChange={(value) =>
                form.setValue(
                  "quietHours",
                  value as NotificationPreferencesInput["quietHours"],
                  { shouldDirty: true },
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Always deliver</SelectItem>
                <SelectItem value="nights">9 PM - 8 AM</SelectItem>
                <SelectItem value="weekends">Weekends</SelectItem>
                <SelectItem value="both">Nights + weekends</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
        </div>
        <SettingsToggleRow
          label="Batch non-urgent emails"
          description="Combine low-priority updates into a daily digest."
        >
          <Switch
            checked={form.watch("batchNonUrgent")}
            onCheckedChange={(value) =>
              form.setValue("batchNonUrgent", value, { shouldDirty: true })
            }
          />
        </SettingsToggleRow>
      </SettingsSection>
    </>
  );
}
