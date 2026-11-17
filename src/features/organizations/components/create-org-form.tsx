"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createOrgAction } from "../actions";
import { toast } from "sonner";

export function CreateOrgForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [nameTouched, setNameTouched] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const generateSlug = (input: string): string => {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50);
  };

  const validateName = (value: string): string | undefined => {
    if (!value.trim()) return "Name is required";
    if (value.length > 100) return "Name must be 100 characters or less";
    return undefined;
  };

  const validateSlug = (value: string): string | undefined => {
    if (!value) return undefined; // optional, will be auto-generated
    if (value.length < 2) return "Slug must be at least 2 characters";
    if (value.length > 50) return "Slug must be 50 characters or less";
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(value)) {
      return "Slug can only contain lowercase letters, numbers, and hyphens (no leading/trailing hyphens)";
    }
    return undefined;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    if (!slugTouched) {
      setSlug(generateSlug(value));
    }
    if (nameTouched) {
      const error = validateName(value);
      setErrors((prev) => ({ ...prev, name: error ?? "" }));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSlug(value);
    setSlugTouched(true);
    if (slugTouched) {
      const error = validateSlug(value);
      setErrors((prev) => ({ ...prev, slug: error ?? "" }));
    }
  };

  const handleNameBlur = () => {
    setNameTouched(true);
    const error = validateName(name);
    setErrors((prev) => ({ ...prev, name: error ?? "" }));
  };

  const handleSlugBlur = () => {
    setSlugTouched(true);
    const error = validateSlug(slug);
    setErrors((prev) => ({ ...prev, slug: error ?? "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameError = validateName(name);
    const slugError = validateSlug(slug);
    setErrors({ name: nameError ?? "", slug: slugError ?? "" });
    setNameTouched(true);
    setSlugTouched(true);

    if (nameError || slugError) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("name", name.trim());
    if (slug.trim()) formData.append("slug", slug.trim());

    const result = await createOrgAction(undefined, formData);

    if (result.ok) {
      toast.success("Organization created");
      router.push(`/dashboard/organizations/${result.data.id}`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Could not create organization");
      if (result.fieldErrors?.slug) {
        setErrors((prev) => ({ ...prev, slug: result.fieldErrors!.slug![0] }));
      }
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic details</CardTitle>
          <CardDescription>
            Choose a name and slug for your organization. The slug appears in invite links.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization name</Label>
            <Input
              id="name"
              value={name}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              placeholder="Acme Design Studio"
              aria-invalid={nameTouched && !!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
              disabled={loading}
            />
            {errors.name && (
              <p id="name-error" className="text-sm text-destructive" role="alert">
                {errors.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug <span className="text-muted-foreground">(optional)</span></Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">stackivo.me/org/</span>
              <Input
                id="slug"
                value={slug}
                onChange={handleSlugChange}
                onBlur={handleSlugBlur}
                placeholder="acme-design"
                aria-invalid={slugTouched && !!errors.slug}
                aria-describedby={errors.slug ? "slug-error" : undefined}
                disabled={loading}
                maxLength={50}
              />
            </div>
            {errors.slug && (
              <p id="slug-error" className="text-sm text-destructive" role="alert">
                {errors.slug}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Auto-generated from name if left blank. Can only contain lowercase letters, numbers, and hyphens.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What this creates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="space-y-2 list-disc list-inside">
            <li>Your personal workspace (clients, projects, invoices, contracts)</li>
            <li>Team collaboration — invite members with roles (admin, member, viewer)</li>
            <li>Shared client portals and project workspaces</li>
            <li>Organization-level billing and profitability reporting</li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating…
            </>
          ) : (
            "Create organization"
          )}
        </Button>
      </div>
    </form>
  );
}