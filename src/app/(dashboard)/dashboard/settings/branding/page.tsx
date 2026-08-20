"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Check, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  SettingsSection,
  SettingsField,
  SettingsPageHeader,
} from "@/features/settings/components/settings-section";
import { LogoUploader } from "@/features/settings/components/logo-uploader";
import { cn } from "@/lib/utils";
import { useProfile } from "@/features/profile/context";
import { updateBranding } from "@/features/profile/actions";
import type { BrandingInput } from "@/features/profile/schemas";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useSubscription } from "@/features/subscription/hooks/use-subscription";
import { UpgradeCard } from "@/components/shared/upgrade-card";
import {
  removeProfileAsset,
  uploadProfileAsset,
} from "@/features/profile/storage-client";

const BRAND_COLORS = [
  { name: "Indigo", value: "#4F46E5" },
  { name: "Blue", value: "#2563EB" },
  { name: "Emerald", value: "#10B981" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Rose", value: "#F43F5E" },
  { name: "Violet", value: "#8B5CF6" },
  { name: "Slate", value: "#475569" },
  { name: "Black", value: "#0F172A" },
];

export default function BrandingSettingsPage() {
  const { profile, setProfile, refreshProfile } = useProfile();
  const supabase = getBrowserSupabase();
  const { status: subscriptionStatus, canUse } = useSubscription();
  const canCustomizeBranding =
    subscriptionStatus === "ready" && canUse("invoices.custom_branding");

  const form = useForm<BrandingInput>({
    defaultValues: {
      brandColor: profile?.brandColor ?? "",
      brandTagline: profile?.brandTagline ?? "",
      brandSignature: profile?.brandSignature ?? "",
      brandIntro: profile?.brandIntro ?? "",
    },
  });

  const brandColor = form.watch("brandColor") || "#2563EB";

  const saveBranding = form.handleSubmit(async (values) => {
    const res = await updateBranding(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setProfile(res.data?.profile ?? null);
    form.reset(values);
    toast.success(res.message ?? "Branding saved");
  });

  const handleLogoUpload = React.useCallback(
    async (file: File) => {
      if (!profile) return null;
      const { path, signedUrl } = await uploadProfileAsset({
        userId: profile.userId,
        kind: "logo",
        file,
      });
      const { error } = await supabase
        .from("user_profiles")
        .update({ logo_url: path } as never)
        .eq("id", profile.userId);
      if (error) throw error;
      setProfile({ ...profile, logoPath: path, logoUrl: signedUrl });
      void refreshProfile();
      return signedUrl;
    },
    [profile, refreshProfile, setProfile, supabase],
  );

  const handleLogoRemove = React.useCallback(async () => {
    if (!profile) return;
    await removeProfileAsset({
      userId: profile.userId,
      kind: "logo",
      path: profile.logoPath,
    });
    const { error } = await supabase
      .from("user_profiles")
      .update({ logo_url: null } as never)
      .eq("id", profile.userId);
    if (error) throw error;
    setProfile({ ...profile, logoPath: null, logoUrl: null });
    void refreshProfile();
  }, [profile, refreshProfile, setProfile, supabase]);

  const handleIconUpload = React.useCallback(
    async (file: File) => {
      if (!profile) return null;
      const { path, signedUrl } = await uploadProfileAsset({
        userId: profile.userId,
        kind: "brand-icon",
        file,
      });
      const { error } = await supabase
        .from("user_profiles")
        .update({ brand_icon_url: path } as never)
        .eq("id", profile.userId);
      if (error) throw error;
      setProfile({ ...profile, brandIconPath: path, brandIconUrl: signedUrl });
      void refreshProfile();
      return signedUrl;
    },
    [profile, refreshProfile, setProfile, supabase],
  );

  const handleIconRemove = React.useCallback(async () => {
    if (!profile) return;
    await removeProfileAsset({
      userId: profile.userId,
      kind: "brand-icon",
      path: profile.brandIconPath,
    });
    const { error } = await supabase
      .from("user_profiles")
      .update({ brand_icon_url: null } as never)
      .eq("id", profile.userId);
    if (error) throw error;
    setProfile({ ...profile, brandIconPath: null, brandIconUrl: null });
    void refreshProfile();
  }, [profile, refreshProfile, setProfile, supabase]);

  return (
    <>
      <SettingsPageHeader
        title="Branding"
        description="Your logo and color scheme appear on invoices, emails, and the client portal."
      />

      {!canCustomizeBranding && subscriptionStatus !== "loading" ? (
        <UpgradeCard
          icon={Lock}
          title="Unlock custom client-facing branding"
          description="Upgrade to Pro to add your logo, brand icon, accent color, and brand voice across invoices, receipts, emails, and the client portal."
          features={[
            "Logo and icon on PDFs",
            "Custom invoice accent color",
            "Branded email copy",
            "Client portal branding",
          ]}
          requiredPlan="Pro"
          className="mb-2"
        />
      ) : null}

      {canCustomizeBranding ? (
        <>
          <SettingsSection
            title="Brand assets"
            description="Logos and icons used across client-facing documents."
            onSave={saveBranding}
            isDirty={form.formState.isDirty}
            isSubmitting={form.formState.isSubmitting}
          >
            <LogoUploader
              label="Primary logo"
              hint="PNG or SVG on a transparent background · up to 2 MB · 512×512 recommended"
              initialUrl={profile?.logoUrl ?? undefined}
              onUpload={handleLogoUpload}
              onRemove={handleLogoRemove}
            />
            <LogoUploader
              label="Favicon / app icon"
              hint="Square image · 128×128 minimum"
              initialUrl={profile?.brandIconUrl ?? undefined}
              onUpload={handleIconUpload}
              onRemove={handleIconRemove}
            />
          </SettingsSection>

          <SettingsSection
            title="Brand color"
            description="Used for buttons, links, and subtle accents on invoices."
            onSave={saveBranding}
            isDirty={form.formState.isDirty}
            isSubmitting={form.formState.isSubmitting}
          >
            <div className="space-y-4">
              <SettingsField label="Accent color" hint={`Selected: ${brandColor}`}>
                <div className="flex flex-wrap gap-2">
                  {BRAND_COLORS.map((c) => {
                    const active =
                      c.value.toLowerCase() === brandColor.toLowerCase();
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() =>
                          form.setValue("brandColor", c.value, {
                            shouldDirty: true,
                          })
                        }
                        aria-label={`Choose ${c.name}`}
                        aria-pressed={active}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg border transition-transform",
                          active
                            ? "scale-105 ring-2 ring-offset-2 ring-ring"
                            : "hover:scale-105",
                        )}
                        style={{ backgroundColor: c.value }}
                      >
                        {active ? (
                          <Check className="h-4 w-4 text-white" strokeWidth={3} />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </SettingsField>

              <SettingsField
                label="Custom hex"
                hint="Must be a 6-digit hex (e.g. #2563EB)"
              >
                <Input
                  value={brandColor}
                  onChange={(e) =>
                    form.setValue("brandColor", e.target.value, {
                      shouldDirty: true,
                    })
                  }
                  className="max-w-xs font-mono uppercase tracking-widest"
                />
              </SettingsField>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Brand voice"
            description="Default copy used in email signatures and client messages."
            onSave={saveBranding}
            isDirty={form.formState.isDirty}
            isSubmitting={form.formState.isSubmitting}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <SettingsField label="Tagline">
                <Input {...form.register("brandTagline")} />
              </SettingsField>
              <SettingsField label="Email signature">
                <Input {...form.register("brandSignature")} />
              </SettingsField>
            </div>
            <SettingsField
              label="Default intro copy"
              hint="Top of new invoices and proposals"
            >
              <Textarea
                rows={3}
                className="resize-none"
                {...form.register("brandIntro")}
              />
            </SettingsField>
          </SettingsSection>
        </>
      ) : null}
    </>
  );
}
