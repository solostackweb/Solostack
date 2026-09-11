"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy } from "lucide-react";
import {
  SettingsSection,
  SettingsField,
  SettingsPageHeader,
} from "@/features/settings/components/settings-section";
import { useProfile } from "@/features/profile/context";
import {
  updatePublicProfile,
  checkPublicSlugAction,
  claimPublicSlugAction,
  createPortfolioItemAction,
  updatePortfolioItemAction,
  deletePortfolioItemAction,
  reorderPortfolioItemsAction,
} from "@/features/profile/actions";
import type { PublicProfileInput, PortfolioItemInput } from "@/features/profile/schemas";
import type { PortfolioItem } from "@/features/onboarding/types";
import { getInitials } from "@/features/profile/utils";

export default function PublicProfileSettingsPage() {
  const { profile, setProfile, refreshProfile } = useProfile();

  const publicForm = useForm<PublicProfileInput>({
    defaultValues: {
      publicSlug: profile?.publicSlug ?? "",
      publicProfileEnabled: profile?.publicProfileEnabled ?? false,
      publicBio: profile?.publicBio ?? "",
      publicServices: profile?.publicServices ?? [],
      publicIndustries: profile?.publicIndustries ?? [],
      publicLocation: profile?.publicLocation ?? "",
      publicLanguages: profile?.publicLanguages ?? [],
      publicAvailability: profile?.publicAvailability ?? "",
      publicStartingRate: profile?.publicStartingRate ?? undefined,
      publicStartingRateCurrency: profile?.publicStartingRateCurrency ?? "INR",
      publicShowReviews: profile?.publicShowReviews ?? true,
      publicShowPortfolio: profile?.publicShowPortfolio ?? true,
      publicShowStats: profile?.publicShowStats ?? true,
      publicCtaText: profile?.publicCtaText ?? "Start a project",
      publicCtaAction: (profile?.publicCtaAction as "enquiry" | "calendly" | "custom_url") ?? "enquiry",
      publicCustomDomain: profile?.publicCustomDomain ?? "",
      publicSeoTitle: profile?.publicSeoTitle ?? "",
      publicSeoDescription: profile?.publicSeoDescription ?? "",
      publicOgImage: profile?.publicOgImage ?? "",
    },
  });

  const portfolioForm = useForm<PortfolioItemInput>({
    defaultValues: {
      title: "",
      description: "",
      coverImageUrl: "",
      images: [],
      category: "",
      industry: "",
      budgetRange: "",
      duration: "",
      technologies: [],
      clientName: "",
      clientIndustry: "",
      testimonial: "",
      featured: false,
      sortOrder: 0,
      published: false,
    },
  });

  const [checkingSlug, setCheckingSlug] = React.useState(false);
  const [slugAvailable, setSlugAvailable] = React.useState<boolean | null>(null);
  const [editingPortfolioId, setEditingPortfolioId] = React.useState<string | null>(null);

  const savePublic = publicForm.handleSubmit(async (values) => {
    const res = await updatePublicProfile(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setProfile(res.data?.profile ?? null);
    publicForm.reset(values);
    toast.success(res.message ?? "Public profile saved");
  });

  const handleCheckSlug = React.useCallback(async () => {
    const slug = publicForm.watch("publicSlug");
    if (!slug || slug.length < 2) {
      setSlugAvailable(null);
      return;
    }
    setCheckingSlug(true);
    setSlugAvailable(null);
    const res = await checkPublicSlugAction(slug);
    setCheckingSlug(false);
    if (res.ok) {
      setSlugAvailable(res.data.available);
    } else {
      toast.error(res.error);
      setSlugAvailable(false);
    }
  }, []);

  const handleClaimSlug = async () => {
    const slug = publicForm.watch("publicSlug");
    if (!slug) {
      toast.error("Enter a slug first");
      return;
    }
    const res = await claimPublicSlugAction(slug);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message);
    publicForm.setValue("publicProfileEnabled", true, { shouldDirty: true });
    setSlugAvailable(true);
    void refreshProfile();
  };

  const publicUrl = profile?.publicSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${profile.publicSlug}`
    : null;

  const handlePortfolioSubmit = portfolioForm.handleSubmit(async (values) => {
    if (editingPortfolioId) {
      const res = await updatePortfolioItemAction({ ...values, id: editingPortfolioId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Portfolio item updated");
    } else {
      const res = await createPortfolioItemAction(values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Portfolio item created");
    }
    portfolioForm.reset();
    setEditingPortfolioId(null);
    void refreshProfile();
  });

  const handleDeletePortfolio = async (id: string) => {
    if (!window.confirm("Delete this portfolio item?")) return;
    const res = await deletePortfolioItemAction(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Portfolio item deleted");
    void refreshProfile();
  };

  const handleEditPortfolio = (item: PortfolioItem) => {
    portfolioForm.reset({
      ...item,
      images: item.images ?? [],
      technologies: item.technologies ?? [],
    });
    setEditingPortfolioId(item.id);
    document.getElementById("portfolio-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleReorderPortfolio = (items: Array<{ id: string; sortOrder: number }>) => {
    reorderPortfolioItemsAction(items);
    void refreshProfile();
  };

  return (
    <>
      <SettingsPageHeader
        title="Public Profile"
        description="Your public-facing profile at stackivo.me/@yourname — showcase reviews, portfolio, and win new clients."
      />

      {/* Public URL Display */}
      {publicUrl && (
        <SettingsSection title="Public URL" description="Your live profile link">
          <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Badge variant="outline" className="text-sm font-medium">
                <span className="text-success">●</span> Live
              </Badge>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate font-mono text-sm">{publicUrl}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigator.clipboard.writeText(publicUrl)}
                  aria-label="Copy URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => window.open(publicUrl, "_blank")}
            >
              View Profile
            </Button>
          </div>
        </SettingsSection>
      )}

      {/* Slug & Visibility */}
      <SettingsSection
        title="Profile URL & Visibility"
        description="Claim your unique slug and control what's visible publicly."
        onSave={savePublic}
        isDirty={publicForm.formState.isDirty}
        isSubmitting={publicForm.formState.isSubmitting}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <SettingsField
            label="Public slug"
            hint="Your profile will be at stackivo.me/@slug (2-50 chars, lowercase, numbers, hyphens)"
            error={publicForm.formState.errors.publicSlug?.message}
          >
            <div className="flex items-center gap-2">
              <span className="px-3 py-2 text-sm text-muted-foreground bg-muted rounded-md">
                stackivo.me/@
              </span>
              <Input
                {...publicForm.register("publicSlug")}
                onBlur={handleCheckSlug}
                disabled={checkingSlug}
                placeholder="your-name"
              />
              {checkingSlug && <span className="text-xs text-muted-foreground">Checking…</span>}
              {slugAvailable === true && <Badge variant="secondary" className="text-success">Available</Badge>}
              {slugAvailable === false && <Badge variant="secondary" className="text-destructive">Taken</Badge>}
            </div>
          </SettingsField>
          <SettingsField label="Status">
            <div className="flex items-center gap-3">
              <Switch
                checked={publicForm.watch("publicProfileEnabled")}
                onCheckedChange={(value) =>
                  publicForm.setValue("publicProfileEnabled", value, { shouldDirty: true })
                }
                disabled={!slugAvailable}
              />
              <span className="text-sm">
                {publicForm.watch("publicProfileEnabled") ? "Public" : "Private"}
              </span>
            </div>
          </SettingsField>
        </div>

        {!publicForm.watch("publicProfileEnabled") && publicForm.watch("publicSlug") && (
          <div className="mt-4">
            <Button variant="outline" onClick={handleClaimSlug} disabled={!slugAvailable}>
              Claim this URL
            </Button>
          </div>
        )}
      </SettingsSection>

      {/* Public Bio */}
      <SettingsSection
        title="Public Bio"
        description="A short introduction shown on your public profile."
        onSave={savePublic}
        isDirty={publicForm.formState.isDirty}
        isSubmitting={publicForm.formState.isSubmitting}
      >
        <SettingsField label="Bio" hint="Shown publicly. Markdown not supported.">
          <Textarea
            rows={4}
            placeholder="Describe your expertise, approach, and what clients can expect..."
            className="resize-none"
            {...publicForm.register("publicBio")}
          />
        </SettingsField>
      </SettingsSection>

      {/* Services & Industries */}
      <SettingsSection
        title="Services & Industries"
        description="Tags shown on your public profile for discoverability."
        onSave={savePublic}
        isDirty={publicForm.formState.isDirty}
        isSubmitting={publicForm.formState.isSubmitting}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <SettingsField label="Services" hint="Comma-separated (e.g., Web Design, React Development, Brand Identity)">
            <Input
              placeholder="Web Design, React, Branding"
              onBlur={(e) => {
                const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                publicForm.setValue("publicServices", arr, { shouldDirty: true });
              }}
              defaultValue={publicForm.watch("publicServices")?.join(", ")}
            />
          </SettingsField>
          <SettingsField label="Industries" hint="Comma-separated (e.g., SaaS, Fintech, E-commerce, Healthcare)">
            <Input
              placeholder="SaaS, Fintech, E-commerce"
              onBlur={(e) => {
                const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                publicForm.setValue("publicIndustries", arr, { shouldDirty: true });
              }}
              defaultValue={publicForm.watch("publicIndustries")?.join(", ")}
            />
          </SettingsField>
        </div>
      </SettingsSection>

      {/* Location & Availability */}
      <SettingsSection
        title="Location, Languages & Availability"
        onSave={savePublic}
        isDirty={publicForm.formState.isDirty}
        isSubmitting={publicForm.formState.isSubmitting}
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <SettingsField label="Location">
            <Input
              placeholder="Bengaluru, India"
              {...publicForm.register("publicLocation")}
            />
          </SettingsField>
          <SettingsField label="Languages" hint="Comma-separated">
            <Input
              placeholder="English, Hindi, Kannada"
              onBlur={(e) => {
                const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                publicForm.setValue("publicLanguages", arr, { shouldDirty: true });
              }}
              defaultValue={publicForm.watch("publicLanguages")?.join(", ")}
            />
          </SettingsField>
          <SettingsField label="Availability">
            <Input
              placeholder="Available for new projects"
              {...publicForm.register("publicAvailability")}
            />
          </SettingsField>
          <SettingsField label="Starting Rate" hint="Optional">
            <Input
              type="number"
              min="0"
              step="1000"
              placeholder="50000"
              value={publicForm.watch("publicStartingRate") ?? ""}
              onChange={(e) => publicForm.setValue("publicStartingRate", e.target.value ? Number(e.target.value) : undefined, { shouldDirty: true })}
            />
          </SettingsField>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 mt-4">
          <SettingsField label="Currency">
            <Select
              value={publicForm.watch("publicStartingRateCurrency")}
              onValueChange={(value) => publicForm.setValue("publicStartingRateCurrency", value, { shouldDirty: true })}
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
          <SettingsField label="CTA Text">
            <Input
              placeholder="Start a project"
              {...publicForm.register("publicCtaText")}
            />
          </SettingsField>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 mt-4">
          <SettingsField label="CTA Action">
            <Select
              value={publicForm.watch("publicCtaAction")}
              onValueChange={(value) => publicForm.setValue("publicCtaAction", value as "enquiry" | "calendly" | "custom_url", { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enquiry">Enquiry Form</SelectItem>
                <SelectItem value="calendly">Calendly Link</SelectItem>
                <SelectItem value="custom_url">Custom URL</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label="Custom CTA URL" hint="Used when CTA Action is Custom URL">
            <Input
              placeholder="https://calendly.com/yourname"
              {...publicForm.register("publicCustomDomain")}
            />
          </SettingsField>
        </div>
      </SettingsSection>

      {/* Visibility Controls */}
      <SettingsSection
        title="Visibility Controls"
        description="Choose what appears on your public profile."
        onSave={savePublic}
        isDirty={publicForm.formState.isDirty}
        isSubmitting={publicForm.formState.isSubmitting}
      >
        <div className="space-y-4">
          <SettingsField label="Show verified reviews">
            <Switch
              checked={publicForm.watch("publicShowReviews")}
              onCheckedChange={(value) =>
                publicForm.setValue("publicShowReviews", value, { shouldDirty: true })
              }
            />
          </SettingsField>
          <SettingsField label="Show portfolio">
            <Switch
              checked={publicForm.watch("publicShowPortfolio")}
              onCheckedChange={(value) =>
                publicForm.setValue("publicShowPortfolio", value, { shouldDirty: true })
              }
            />
          </SettingsField>
          <SettingsField label="Show stats (completed projects, repeat clients, etc.)">
            <Switch
              checked={publicForm.watch("publicShowStats")}
              onCheckedChange={(value) =>
                publicForm.setValue("publicShowStats", value, { shouldDirty: true })
              }
            />
          </SettingsField>
        </div>
      </SettingsSection>

      {/* SEO */}
      <SettingsSection
        title="SEO & Social Sharing"
        description="Meta tags for search engines and link previews."
        onSave={savePublic}
        isDirty={publicForm.formState.isDirty}
        isSubmitting={publicForm.formState.isSubmitting}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <SettingsField label="SEO Title" hint="Max 60 characters">
            <Input
              maxLength={60}
              placeholder="Your Name — Freelance Designer & Developer"
              {...publicForm.register("publicSeoTitle")}
            />
          </SettingsField>
          <SettingsField label="SEO Description" hint="Max 160 characters">
            <Input
              maxLength={160}
              placeholder="Freelance designer helping SaaS companies build beautiful products..."
              {...publicForm.register("publicSeoDescription")}
            />
          </SettingsField>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 mt-4">
          <SettingsField label="Open Graph Image URL" hint="1200x630px recommended">
            <Input
              placeholder="https://example.com/og-image.png"
              {...publicForm.register("publicOgImage")}
            />
          </SettingsField>
        </div>
      </SettingsSection>

      {/* Portfolio */}
      <SettingsSection
        title="Portfolio"
        description="Featured projects displayed on your public profile. Drag to reorder."
        onSave={() => {}}
        isDirty={false}
      >
        <div className="space-y-4">
          {/* Add/Edit Form */}
          <div id="portfolio-form" className="rounded-lg border bg-muted/30 p-5 space-y-4">
            <h4 className="font-medium">{editingPortfolioId ? "Edit Portfolio Item" : "Add Portfolio Item"}</h4>
            <form onSubmit={handlePortfolioSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingsField label="Title" error={portfolioForm.formState.errors.title?.message}>
                  <Input {...portfolioForm.register("title", { required: true })} />
                </SettingsField>
                <SettingsField label="Category" error={portfolioForm.formState.errors.category?.message}>
                  <Input {...portfolioForm.register("category")} placeholder="Web Design" />
                </SettingsField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingsField label="Industry">
                  <Input {...portfolioForm.register("industry")} placeholder="SaaS" />
                </SettingsField>
                <SettingsField label="Budget Range">
                  <Input {...portfolioForm.register("budgetRange")} placeholder="₹50,000 - ₹1,00,000" />
                </SettingsField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingsField label="Duration">
                  <Input {...portfolioForm.register("duration")} placeholder="3 months" />
                </SettingsField>
                <SettingsField label="Client Name">
                  <Input {...portfolioForm.register("clientName")} placeholder="Acme Corp" />
                </SettingsField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingsField label="Client Industry">
                  <Input {...portfolioForm.register("clientIndustry")} placeholder="Fintech" />
                </SettingsField>
                <SettingsField label="Cover Image URL">
                  <Input {...portfolioForm.register("coverImageUrl")} placeholder="https://example.com/cover.jpg" />
                </SettingsField>
              </div>
              <SettingsField label="Description" hint="Markdown supported">
                <Textarea
                  rows={3}
                  placeholder="Project overview, challenges, solutions, results..."
                  className="resize-none"
                  {...portfolioForm.register("description")}
                />
              </SettingsField>
              <SettingsField label="Technologies" hint="Comma-separated (e.g., React, TypeScript, Tailwind, PostgreSQL)">
                <Input
                  placeholder="React, TypeScript, Tailwind, PostgreSQL"
                  onBlur={(e) => {
                    const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                    portfolioForm.setValue("technologies", arr, { shouldDirty: true });
                  }}
                  defaultValue={portfolioForm.watch("technologies")?.join(", ")}
                />
              </SettingsField>
              <SettingsField label="Testimonial">
                <Textarea
                  rows={2}
                  placeholder="Client quote about the project..."
                  className="resize-none"
                  {...portfolioForm.register("testimonial")}
                />
              </SettingsField>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...portfolioForm.register("featured")} className="h-4 w-4" />
                  Featured
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...portfolioForm.register("published")} className="h-4 w-4" />
                  Published
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                {editingPortfolioId && (
                  <Button type="button" variant="ghost" onClick={() => { portfolioForm.reset(); setEditingPortfolioId(null); }}>
                    Cancel
                  </Button>
                )}
                <Button type="submit">
                  {editingPortfolioId ? "Update" : "Add"} Portfolio Item
                </Button>
              </div>
            </form>
          </div>

          {/* Portfolio List */}
          <div className="space-y-3">
            {(profile?.portfolio ?? []).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No portfolio items yet. Add one above!</p>
            ) : (
              <ul id="portfolio-list" className="space-y-3">
                {(profile?.portfolio ?? []).map((item, index) => (
                  <li key={item.id} className="rounded-lg border bg-card p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{item.title}</span>
                        {item.featured && <Badge variant="secondary" className="text-xs">Featured</Badge>}
                        {item.published && <Badge variant="outline" className="text-xs">Published</Badge>}
                        {!item.published && <Badge variant="secondary" className="text-xs text-muted-foreground">Draft</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{item.description || "No description"}</p>
                      <div className="flex flex-wrap gap-1 mt-2 text-xs text-muted-foreground">
                        {item.category && <Badge variant="secondary">{item.category}</Badge>}
                        {item.industry && <Badge variant="outline">{item.industry}</Badge>}
                        {item.budgetRange && <Badge variant="outline">{item.budgetRange}</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => handleEditPortfolio(item as PortfolioItem)} aria-label="Edit">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeletePortfolio(item.id)}
                        aria-label="Delete"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </Button>
                      <button
                        className="p-2 text-muted-foreground hover:text-foreground"
                        onMouseDown={() => {
                          // Simple reorder: move up
                          if (index > 0) {
                            const items = [...(profile?.portfolio ?? [])];
                            [items[index], items[index - 1]] = [items[index - 1], items[index]];
                            handleReorderPortfolio(items.map((item, idx) => ({ id: item.id, sortOrder: idx })));
                          }
                        }}
                        aria-label="Move up"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                      </button>
                      <button
                        className="p-2 text-muted-foreground hover:text-foreground"
                        onMouseDown={() => {
                          const items = [...(profile?.portfolio ?? [])];
                          if (index < items.length - 1) {
                            [items[index], items[index + 1]] = [items[index + 1], items[index]];
                            handleReorderPortfolio(items.map((item, idx) => ({ id: item.id, sortOrder: idx })));
                          }
                        }}
                        aria-label="Move down"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7v-18" /></svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SettingsSection>
    </>
  );
}