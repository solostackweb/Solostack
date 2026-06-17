"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { WelcomeDocumentSection } from "../types";
import { WelcomeMarkdown } from "../markdown";
import {
  createWelcomeDocumentAction,
  updateWelcomeDocumentAction,
} from "../actions";
import { welcomeDocumentDetail } from "../routes";

interface ClientOption {
  id: string;
  name: string;
  email: string | null;
}

interface BaseProps {
  clients: ClientOption[];
  initial: {
    title: string;
    intro: string;
    sections: WelcomeDocumentSection[];
    clientId: string | null;
    brandColor: string | null;
    acknowledgementRequired: boolean;
  };
}

type Props =
  | (BaseProps & { mode: "create" })
  | (BaseProps & { mode: "edit"; documentId: string });

const UNASSIGNED = "__unassigned__";

/**
 * Section-by-section editor for a Welcome Document. The heading is a
 * single-line input; the body is a markdown textarea with a live
 * preview pane that mirrors the public viewer's typography.
 *
 * Save semantics:
 *   - create → POST then redirect to `/dashboard/welcome/<id>`
 *   - edit   → PATCH and stay on page; toast on success
 */
export function WelcomeEditor(props: Props) {
  const router = useRouter();
  const [title, setTitle] = React.useState(props.initial.title);
  const [intro, setIntro] = React.useState(props.initial.intro);
  const [sections, setSections] = React.useState<WelcomeDocumentSection[]>(
    props.initial.sections.length
      ? props.initial.sections
      : [{ id: "s_1", heading: "", body: "" }],
  );
  const [clientId, setClientId] = React.useState<string>(
    props.initial.clientId ?? UNASSIGNED,
  );
  const [brandColor, setBrandColor] = React.useState<string>(
    props.initial.brandColor ?? "#2563EB",
  );
  const [ackRequired, setAckRequired] = React.useState<boolean>(
    props.initial.acknowledgementRequired,
  );
  const [showPreview, setShowPreview] = React.useState(true);
  const [pending, startTransition] = React.useTransition();

  const onUpdateSection = (
    idx: number,
    patch: Partial<WelcomeDocumentSection>,
  ) =>
    setSections((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );

  const onMoveSection = (idx: number, dir: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target]!, next[idx]!];
      return next;
    });
  };

  const onAddSection = () =>
    setSections((prev) => [
      ...prev,
      { id: `s_${prev.length + 1}`, heading: "", body: "" },
    ]);

  const onRemoveSection = (idx: number) =>
    setSections((prev) => prev.filter((_, i) => i !== idx));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Give the document a title.");
      return;
    }
    const cleanedSections = sections
      .map((s) => ({ heading: s.heading.trim(), body: s.body }))
      .filter((s) => s.heading || s.body.trim());
    if (cleanedSections.length === 0) {
      toast.error("Add at least one section.");
      return;
    }

    const payload = {
      title: title.trim(),
      intro: intro.trim() || null,
      sections: cleanedSections,
      clientId: clientId === UNASSIGNED ? null : clientId,
      brandColor: brandColor || null,
      acknowledgementRequired: ackRequired,
    };

    startTransition(async () => {
      if (props.mode === "create") {
        const res = await createWelcomeDocumentAction(payload);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Saved.");
        if (res.data?.id) router.push(welcomeDocumentDetail(res.data.id));
      } else {
        const res = await updateWelcomeDocumentAction({
          id: props.documentId,
          ...payload,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Saved.");
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Header / metadata */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <Label htmlFor="wd-title" className="text-xs">
              Title
            </Label>
            <Input
              id="wd-title"
              placeholder="Welcome to our project"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
              maxLength={200}
              required
            />
          </div>
          <div>
            <Label htmlFor="wd-intro" className="text-xs">
              Intro <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="wd-intro"
              placeholder="A short greeting that sets the tone…"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              className="mt-1.5 min-h-[80px]"
              maxLength={5000}
            />
          </div>
          {/* Client assignment — prominent, with model explanation */}
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <UserCheck className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <Label className="text-sm font-medium">Assign to a client</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Each welcome document is personalised for one client — names, emails,
                  and the PDF cover all reflect their details.{" "}
                  <span className="font-medium text-foreground">
                    To reuse this for another client, duplicate it from the list.
                  </span>
                </p>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="mt-2.5 h-9 w-full sm:w-64">
                    <SelectValue placeholder="Choose a client…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>
                      No client (draft / general)
                    </SelectItem>
                    {props.clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.email ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            · {c.email}
                          </span>
                        ) : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="wd-brand" className="text-xs">
                Brand colour
              </Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  id="wd-brand"
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer p-1"
                />
                <Input
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-9 flex-1 font-mono text-xs uppercase"
                  maxLength={7}
                />
              </div>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <Switch
                  checked={ackRequired}
                  onCheckedChange={setAckRequired}
                />
                <span className="mt-[-2px]">
                  <span className="block font-medium">Ask for acknowledgement</span>
                  <span className="block text-xs text-muted-foreground">
                    Client taps &ldquo;I&rsquo;ve read and understood&rdquo; at the end.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Sections — {sections.length}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview((v) => !v)}
        >
          {showPreview ? (
            <>
              <EyeOff className="h-3.5 w-3.5" /> Hide preview
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" /> Show preview
            </>
          )}
        </Button>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section, idx) => (
          <Card key={section.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Section {idx + 1}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={idx === 0}
                  onClick={() => onMoveSection(idx, -1)}
                  aria-label="Move section up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={idx === sections.length - 1}
                  onClick={() => onMoveSection(idx, 1)}
                  aria-label="Move section down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => onRemoveSection(idx)}
                  disabled={sections.length <= 1}
                  aria-label="Remove section"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <Input
                placeholder="Section heading"
                value={section.heading}
                onChange={(e) =>
                  onUpdateSection(idx, { heading: e.target.value })
                }
                maxLength={200}
              />
              <div
                className={
                  showPreview
                    ? "grid gap-3 md:grid-cols-2"
                    : "grid gap-3"
                }
              >
                <Textarea
                  placeholder="Body — supports **bold**, *italic*, [links](https://…), `code`, lists, and > quotes."
                  value={section.body}
                  onChange={(e) =>
                    onUpdateSection(idx, { body: e.target.value })
                  }
                  className="min-h-[160px] font-mono text-xs"
                  maxLength={20_000}
                />
                {showPreview && (
                  <div className="rounded-md border bg-muted/30 p-4">
                    {section.body.trim() ? (
                      <WelcomeMarkdown source={section.body} />
                    ) : (
                      <p className="text-xs italic text-muted-foreground">
                        Live preview appears here as you type.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onAddSection}
        size="sm"
      >
        <Plus className="h-3.5 w-3.5" /> Add section
      </Button>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-md sm:border sm:px-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          <Save className="h-3.5 w-3.5" />
          {pending
            ? "Saving…"
            : props.mode === "create"
              ? "Save draft"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
