"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Star, Clock } from "lucide-react";
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
} from "@/features/settings/components/settings-section";
import { LogoUploader } from "@/features/settings/components/logo-uploader";
import { useProfile } from "@/features/profile/context";
import type { BusinessProfile } from "@/features/onboarding/types";
import { getBrowserSupabase } from "@/lib/supabase/client";
import {
  getCurrentPublicProfileStats,
  updateLocalization,
  updatePersonalProfile,
  updateSignature,
} from "@/features/profile/actions";
import { FreelancerSignatureCard } from "@/features/profile/components/freelancer-signature-card";
import { AccountSecurityCard } from "@/features/settings/components/account-security-card";
import type {
  LocalizationInput,
  PersonalProfileInput,
} from "@/features/profile/schemas";
import {
  removeProfileAsset,
  uploadProfileAsset,
} from "@/features/profile/storage-client";

export default function ProfileSettingsPage() {
  const { profile, setProfile, refreshProfile } = useProfile();
  const supabase = getBrowserSupabase();

  const personalForm = useForm<PersonalProfileInput>({
    defaultValues: {
      fullName: profile?.fullName ?? "",
      displayName: profile?.displayName ?? "",
      email: profile?.email ?? "",
      phone: profile?.phone ?? "",
      role: profile?.role ?? "",
      bio: profile?.bio ?? "",
    },
  });

  const localizationForm = useForm<LocalizationInput>({
    defaultValues: {
      timezone: profile?.timezone ?? "Asia/Kolkata",
      defaultCurrency: profile?.defaultCurrency ?? "INR",
    },
  });

  const savePersonal = personalForm.handleSubmit(async (values) => {
    const res = await updatePersonalProfile(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setProfile(res.data?.profile ?? null);
    personalForm.reset(values);
    toast.success(res.message ?? "Profile saved");
  });

  const saveLocalization = localizationForm.handleSubmit(async (values) => {
    const res = await updateLocalization(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setProfile(res.data?.profile ?? null);
    localizationForm.reset(values);
    toast.success(res.message ?? "Localization saved");
  });

  const handleAvatarUpload = React.useCallback(
    async (file: File) => {
      if (!profile) return null;
      const { path, signedUrl } = await uploadProfileAsset({
        userId: profile.userId,
        kind: "avatar",
        file,
      });
      const { error } = await supabase
        .from("user_profiles")
        .update({ avatar_url: path } as never)
        .eq("id", profile.userId);
      if (error) throw error;
      setProfile({
        ...profile,
        avatarPath: path,
        avatarUrl: signedUrl,
      });
      void refreshProfile();
      return signedUrl;
    },
    [profile, refreshProfile, setProfile, supabase],
  );

  const handleAvatarRemove = React.useCallback(async () => {
    if (!profile) return;
    await removeProfileAsset({
      userId: profile.userId,
      kind: "avatar",
      path: profile.avatarPath,
    });
    const { error } = await supabase
      .from("user_profiles")
      .update({ avatar_url: null } as never)
      .eq("id", profile.userId);
    if (error) throw error;
    setProfile({ ...profile, avatarPath: null, avatarUrl: null });
    void refreshProfile();
  }, [profile, refreshProfile, setProfile, supabase]);

  const { errors: personalErrors, isDirty: personalDirty, isSubmitting: personalSubmitting } =
    personalForm.formState;
  const { errors: localizationErrors, isDirty: localizationDirty, isSubmitting: localizationSubmitting } =
    localizationForm.formState;

  return (
    <>
      <SettingsPageHeader
        title="Profile"
        description="Manage how you appear across Stackivo."
      />

      <SettingsSection
        title="Personal information"
        description="Name, email, and avatar shown on invoices and client communications."
        onSave={savePersonal}
        onCancel={() => personalForm.reset()}
        isDirty={personalDirty}
        isSubmitting={personalSubmitting}
      >
        <LogoUploader
          label="Avatar"
          shape="circle"
          hint="JPG, PNG or SVG · up to 2 MB"
          initialUrl={profile?.avatarUrl ?? undefined}
          onUpload={handleAvatarUpload}
          onRemove={handleAvatarRemove}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <SettingsField
            label="Full name"
            htmlFor="fullName"
            error={personalErrors.fullName?.message}
          >
            <Input id="fullName" {...personalForm.register("fullName")} />
          </SettingsField>
          <SettingsField
            label="Display name"
            htmlFor="displayName"
            error={personalErrors.displayName?.message}
          >
            <Input id="displayName" {...personalForm.register("displayName")} />
          </SettingsField>
          <SettingsField
            label="Email address"
            htmlFor="email"
            error={personalErrors.email?.message}
          >
            <Input id="email" type="email" {...personalForm.register("email")} />
          </SettingsField>
          <SettingsField
            label="Phone number"
            htmlFor="phone"
            error={personalErrors.phone?.message}
          >
            <Input id="phone" type="tel" {...personalForm.register("phone")} />
          </SettingsField>
          <SettingsField label="Role" htmlFor="role">
            <Input id="role" {...personalForm.register("role")} />
          </SettingsField>
        </div>

        <SettingsField
          label="Bio"
          hint="Shown on client-facing documents."
          error={personalErrors.bio?.message}
        >
          <Textarea
            rows={3}
            placeholder="Short intro, pronouns, links..."
            className="resize-none"
            {...personalForm.register("bio")}
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection
        title="Localization"
        description="Your default timezone, currency, and date preferences."
        onSave={saveLocalization}
        isDirty={localizationDirty}
        isSubmitting={localizationSubmitting}
      >
        <div className="grid gap-5 sm:grid-cols-3">
          <SettingsField label="Timezone" error={localizationErrors.timezone?.message}>
            <Select
              value={localizationForm.watch("timezone")}
              onValueChange={(value) =>
                localizationForm.setValue("timezone", value, {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Asia/Kolkata">(GMT+05:30) India Standard Time</SelectItem>
                <SelectItem value="UTC">(GMT+00:00) UTC</SelectItem>
                <SelectItem value="America/Los_Angeles">(GMT-08:00) Pacific Time</SelectItem>
                <SelectItem value="America/New_York">(GMT-05:00) Eastern Time</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label="Currency" error={localizationErrors.defaultCurrency?.message}>
            <Select
              value={localizationForm.watch("defaultCurrency")}
              onValueChange={(value) =>
                localizationForm.setValue("defaultCurrency", value, {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">INR · Indian Rupee</SelectItem>
                <SelectItem value="USD">USD · US Dollar</SelectItem>
                <SelectItem value="EUR">EUR · Euro</SelectItem>
                <SelectItem value="GBP">GBP · British Pound</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
        </div>
      </SettingsSection>

      <div id="signature">
        <SettingsSection
          title="Freelancer signature"
          description="Configure the signature that appears on your contracts and invoices."
        >
          <FreelancerSignatureCard
            profile={profile}
            title="Signature setup"
            description="This signature is used across Stackivo when you issue documents or sign proposals."
            buttonLabel="Add signature"
            onSave={async (signature) => {
              const res = await updateSignature({
                signatureType: signature.type,
                signatureImageUrl: signature.imageUrl,
                signatureTextValue: signature.textValue,
                signatureFontFamily: signature.fontFamily,
              });
              if (!res.ok) {
                throw new Error(res.error);
              }
              setProfile(res.data?.profile ?? null);
              void refreshProfile();
            }}
          />
        </SettingsSection>
      </div>

      <AccountSecurityCard />

      {/* Reputation analytics */}
      <ReputationAnalyticsCard profile={profile} />
    </>
  );
}

/** Reputation analytics dashboard — shows review velocity, rating trends, and delivery performance. */
function ReputationAnalyticsCard({ profile }: { profile: BusinessProfile | null }) {
  const [stats, setStats] = React.useState<
    Awaited<ReturnType<typeof getCurrentPublicProfileStats>>
  >(null);

  React.useEffect(() => {
    if (!profile?.userId) return;
    ;(async () => {
      const data = await getCurrentPublicProfileStats();
      if (data) setStats(data);
    })();
  }, [profile?.userId]);

  if (!stats) return <p className="text-muted-foreground">Loading reputation data...</p>;

  const ratingStars = Math.round(stats.average_rating ?? 0);
  return (
    <SettingsSection
      title="Reputation analytics"
      description="Your verified performance metrics across Stackivo."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="rounded-lg bg-card p-4 flex items-start gap-3">
            <div className="flex-shrink-0 rounded-lg bg-violet-500/10 p-2">
              <Star className="h-4 w-4 text-warning" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Completed projects</p>
              <p className="text-lg font-medium">{stats.completed_projects}</p>
            </div>
          </div>
        </div>
        <div>
          <div className="rounded-lg bg-card p-4 flex items-start gap-3">
            <div className="flex-shrink-0 rounded-lg bg-violet-500/10 p-2">
              <Star className="h-4 w-4 fill-warning text-warning" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Verified reviews</p>
              <p className="text-lg font-medium">{stats.verified_reviews}</p>
            </div>
          </div>
        </div>
        <div>
          <div className="rounded-lg bg-card p-4 flex items-start gap-3">
            <div className="flex-shrink-0 rounded-lg bg-violet-500/10 p-2">
              <Star className="h-4 w-4 fill-warning text-warning" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Average rating</p>
              <p className="text-lg font-medium">{stats.average_rating ? ratingStars.toFixed(1) : "—"}</p>
            </div>
          </div>
        </div>
        <div>
          <div className="rounded-lg bg-card p-4 flex items-start gap-3">
            <div className="flex-shrink-0 rounded-lg bg-violet-500/10 p-2">
              <Clock className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">On-time delivery</p>
              <p className="text-lg font-medium">
                {stats.on_time_delivery_rate ? `${stats.on_time_delivery_rate}%` : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t">
        <p className="text-sm text-muted-foreground">Repeat clients</p>
        <p className="text-lg font-medium">{stats.repeat_clients}</p>
        <p className="text-xs text-muted-foreground">Total project value</p>
        <p className="text-lg font-medium">₹{stats.total_project_value.toLocaleString("en-IN")}</p>
      </div>
    </SettingsSection>
  );
}
