"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  GripVertical,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { updateLeadFormAction, type LeadFormActionResult } from "../actions";
import {
  CORE_LEAD_FIELDS,
  STANDARD_LEAD_FIELDS,
  makeCustomFieldName,
  normalizeLeadFields,
  type LeadFieldType,
  type LeadFormField,
} from "../fields";
import type { LeadFormRecord } from "../server";

interface CustomField {
  name: string;
  label: string;
  type: "text" | "textarea";
  required: boolean;
}

export function LeadFormBuilder({
  form,
  publicBaseUrl,
}: {
  form: LeadFormRecord;
  publicBaseUrl: string;
}) {
  const initial = React.useMemo(
    () => normalizeLeadFields((form as { fields?: unknown }).fields),
    [form],
  );
  const initialByName = React.useMemo(
    () => new Map(initial.map((f) => [f.name, f])),
    [initial],
  );

  const [name, setName] = React.useState(form.name);
  const [title, setTitle] = React.useState(form.title);
  const [description, setDescription] = React.useState(form.description ?? "");
  const [brandColor, setBrandColor] = React.useState(form.brand_color);

  const [enabled, setEnabled] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      STANDARD_LEAD_FIELDS.map((f) => [
        f.name,
        CORE_LEAD_FIELDS.has(f.name) || initialByName.has(f.name),
      ]),
    ),
  );
  const [required, setRequired] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      STANDARD_LEAD_FIELDS.map((f) => [
        f.name,
        CORE_LEAD_FIELDS.has(f.name)
          ? true
          : (initialByName.get(f.name)?.required ?? f.required),
      ]),
    ),
  );
  const [customFields, setCustomFields] = React.useState<CustomField[]>(() =>
    initial
      .filter((f) => f.custom)
      .map((f) => ({
        name: f.name,
        label: f.label,
        type: f.type === "textarea" ? "textarea" : "text",
        required: f.required,
      })),
  );

  const orderedFields: LeadFormField[] = React.useMemo(() => {
    const std = STANDARD_LEAD_FIELDS.filter((f) => enabled[f.name]).map((f) => ({
      name: f.name,
      label: initialByName.get(f.name)?.label ?? f.label,
      type: f.type,
      required: CORE_LEAD_FIELDS.has(f.name) ? true : !!required[f.name],
    }));
    const custom = customFields
      .filter((f) => f.label.trim())
      .map((f) => ({
        name: f.name,
        label: f.label.trim(),
        type: f.type as LeadFieldType,
        required: f.required,
        custom: true,
      }));
    return [...std, ...custom];
  }, [enabled, required, customFields, initialByName]);

  const [state, formAction] = useActionState<
    LeadFormActionResult | undefined,
    FormData
  >(updateLeadFormAction, undefined);

  React.useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Form saved");
    else if (state && !state.ok) toast.error(state.error);
  }, [state]);

  const publicUrl = `${publicBaseUrl}/lead/${form.slug}`;

  const addCustom = () => {
    const used = new Set([
      ...STANDARD_LEAD_FIELDS.map((f) => f.name),
      ...customFields.map((f) => f.name),
    ]);
    const fieldName = makeCustomFieldName("question", used);
    setCustomFields((prev) => [
      ...prev,
      { name: fieldName, label: "", type: "text", required: false },
    ]);
  };

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={form.id} />
      <input type="hidden" name="fields" value={JSON.stringify(orderedFields)} />

      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link href="/dashboard/lead-forms">
              <ArrowLeft className="h-4 w-4" /> Lead forms
            </Link>
          </Button>
          <h1 className="truncate text-3xl font-bold tracking-tight">
            Customize form
          </h1>
          <p className="mt-1 text-muted-foreground">
            Choose which questions to ask and add your own. Changes apply to the
            public form when you save.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/lead/${form.slug}`} target="_blank">
              <ExternalLink className="h-4 w-4" /> Preview
            </Link>
          </Button>
          <SaveButton />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {/* Settings */}
          <Card>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Internal name" className="sm:col-span-2">
                <Input
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Public title" className="sm:col-span-2">
                <Input
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Textarea
                  name="description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Share what kind of work you are accepting."
                />
              </Field>
              <Field label="Brand colour">
                <div className="flex gap-2">
                  <Input
                    name="brandColor"
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="w-16 p-1"
                  />
                  <Input
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    aria-label="Brand colour hex"
                  />
                </div>
              </Field>
            </CardContent>
          </Card>

          {/* Standard fields */}
          <Card>
            <CardContent className="space-y-1 p-5">
              <div className="mb-2">
                <h2 className="text-lg font-semibold">Standard fields</h2>
                <p className="text-sm text-muted-foreground">
                  Toggle which built-in questions appear and which are required.
                </p>
              </div>
              {STANDARD_LEAD_FIELDS.map((f) => {
                const isCore = CORE_LEAD_FIELDS.has(f.name);
                const on = !!enabled[f.name];
                return (
                  <div
                    key={f.name}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/50 px-3 py-2.5"
                  >
                    <label className="flex min-w-0 items-center gap-2.5">
                      <Checkbox
                        checked={on}
                        disabled={isCore}
                        onCheckedChange={(v) =>
                          setEnabled((prev) => ({ ...prev, [f.name]: v === true }))
                        }
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {initialByName.get(f.name)?.label ?? f.label}
                        </span>
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {f.type}
                          {isCore ? " · always on" : ""}
                        </span>
                      </span>
                    </label>
                    <label
                      className={cn(
                        "flex items-center gap-2 text-xs text-muted-foreground",
                        (!on || isCore) && "opacity-50",
                      )}
                    >
                      <Checkbox
                        checked={isCore ? true : !!required[f.name]}
                        disabled={isCore || !on}
                        onCheckedChange={(v) =>
                          setRequired((prev) => ({
                            ...prev,
                            [f.name]: v === true,
                          }))
                        }
                      />
                      Required
                    </label>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Custom questions */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Custom questions</h2>
                  <p className="text-sm text-muted-foreground">
                    Ask anything specific to your work. Answers are saved with the
                    lead.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addCustom}>
                  <Plus className="h-4 w-4" /> Add question
                </Button>
              </div>

              {customFields.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  No custom questions yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {customFields.map((f, index) => (
                    <div
                      key={f.name}
                      className="grid gap-2 rounded-lg border bg-background/50 p-3 sm:grid-cols-[16px_minmax(0,1fr)_150px_auto_auto] sm:items-center"
                    >
                      <GripVertical className="hidden h-4 w-4 text-muted-foreground/40 sm:block" />
                      <Input
                        value={f.label}
                        placeholder="Your question"
                        onChange={(e) =>
                          setCustomFields((prev) =>
                            prev.map((x, i) =>
                              i === index ? { ...x, label: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <Select
                        value={f.type}
                        onValueChange={(v) =>
                          setCustomFields((prev) =>
                            prev.map((x, i) =>
                              i === index
                                ? { ...x, type: v as "text" | "textarea" }
                                : x,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Short answer</SelectItem>
                          <SelectItem value="textarea">Paragraph</SelectItem>
                        </SelectContent>
                      </Select>
                      <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={f.required}
                          onCheckedChange={(v) =>
                            setCustomFields((prev) =>
                              prev.map((x, i) =>
                                i === index ? { ...x, required: v === true } : x,
                              ),
                            )
                          }
                        />
                        Required
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove question"
                        onClick={() =>
                          setCustomFields((prev) =>
                            prev.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview + share */}
        <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div
              className="border-b p-4"
              style={{
                background: `linear-gradient(135deg, ${brandColor}14, transparent)`,
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Live preview
              </p>
              <h2 className="mt-1 text-lg font-semibold">{title || "Untitled form"}</h2>
              {description ? (
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <div className="space-y-2.5 p-4">
              {orderedFields.map((f) => (
                <div key={f.name}>
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    {f.label}
                    {f.required ? (
                      <span className="ml-1 text-destructive">*</span>
                    ) : null}
                  </p>
                  <div
                    className={cn(
                      "mt-1 rounded-md border bg-background",
                      f.type === "textarea" ? "h-14" : "h-9",
                    )}
                  />
                </div>
              ))}
              <div
                className="mt-3 flex h-10 items-center justify-center rounded-lg text-sm font-medium text-white"
                style={{ background: brandColor }}
              >
                Send inquiry
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Public link
            </p>
            <p className="mt-2 truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
              {publicUrl}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={() => {
                void navigator.clipboard?.writeText(publicUrl);
                toast.success("Link copied");
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Copy link
            </Button>
          </div>
        </aside>
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? (
        "Saving..."
      ) : (
        <>
          <Save className="h-4 w-4" /> Save form
        </>
      )}
    </Button>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("space-y-1.5", className)}>
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
