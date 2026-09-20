"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitProfileEnquiryAction } from "@/features/profile/actions";

/**
 * Public "Start a project" enquiry form on /p/[slug].
 * No login required — submits to submitProfileEnquiryAction which creates
 * a client (needs_review) + lead project + owner notification.
 */
export function PublicEnquiryForm({ slug }: { slug: string }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [project, setProject] = React.useState("");
  const [budget, setBudget] = React.useState("");
  const [timeline, setTimeline] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [sent, setSent] = React.useState(false);
  const websiteRef = React.useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    const res = await submitProfileEnquiryAction({
      slug,
      name: name.trim(),
      email: email.trim(),
      company: company.trim(),
      phone: phone.trim(),
      project: project.trim(),
      budget: budget.trim(),
      timeline: timeline.trim(),
      website: websiteRef.current?.value ?? "",
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-2">
          <p className="font-semibold">Enquiry sent.</p>
          <p className="text-sm text-muted-foreground">
            Thanks for reaching out — you&apos;ll hear back shortly.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="enquiry-name" className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="enquiry-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
                autoComplete="name"
              />
              {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor="enquiry-email" className="text-sm font-medium">
                Email <span className="text-destructive">*</span>
              </label>
              <Input
                id="enquiry-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={180}
                required
                autoComplete="email"
              />
              {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="enquiry-company" className="text-sm font-medium">Company</label>
              <Input
                id="enquiry-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={160}
                autoComplete="organization"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="enquiry-phone" className="text-sm font-medium">Phone</label>
              <Input
                id="enquiry-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={40}
                autoComplete="tel"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="enquiry-project" className="text-sm font-medium">
              Project details <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="enquiry-project"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              rows={4}
              maxLength={3000}
              required
              placeholder="What do you want to build? Goals, scope, links…"
              className="resize-none"
            />
            {fieldErrors.project && <p className="text-xs text-destructive">{fieldErrors.project[0]}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="enquiry-budget" className="text-sm font-medium">Budget range</label>
              <Input
                id="enquiry-budget"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                maxLength={120}
                placeholder="e.g. ₹50,000 – ₹1,00,000"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="enquiry-timeline" className="text-sm font-medium">Timeline</label>
              <Input
                id="enquiry-timeline"
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                maxLength={160}
                placeholder="e.g. 6 weeks"
              />
            </div>
          </div>
          {/* Honeypot — real users never see this */}
          <input ref={websiteRef} type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Send enquiry
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
