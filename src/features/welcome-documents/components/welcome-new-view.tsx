"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, FileText, Library, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import type { AiWelcomeDraft } from "@/features/ai-workflows/types";

import type {
  WelcomeDocumentTemplate,
  WelcomeDocumentSection,
} from "../types";
import { WelcomeEditor } from "./welcome-editor";
import { WELCOME_DOCUMENT_NEW, WELCOME_DOCUMENTS_INDEX } from "../routes";
import { BUILTIN_WELCOME_TEMPLATES } from "../templates";

interface ClientOption {
  id: string;
  name: string;
  email: string | null;
}

interface Props {
  templates: WelcomeDocumentTemplate[];
  preset: WelcomeDocumentTemplate | null;
  clients: ClientOption[];
  defaultBrandColor: string | null;
}

const BLANK_SECTIONS: WelcomeDocumentSection[] = [
  {
    id: "s_1",
    heading: "Welcome",
    body: "Hi there — thanks for choosing to work with us. This short guide covers everything you'll need to know to get started.",
  },
];

/**
 * Built-in system templates — now defined in `../templates` so the AI
 * assistant can seed a draft from the same content. Shown whenever the DB
 * returns no system templates.
 */
const BUILTIN_TEMPLATES: WelcomeDocumentTemplate[] = BUILTIN_WELCOME_TEMPLATES;

/**
 * Two-step "new document" flow:
 *   1. Pick a template (or "Start blank")
 *   2. Edit and save
 *
 * The router URL itself does the routing — `?template=<id>` becomes
 * the seed; otherwise we render the template grid.
 */
export function WelcomeNewView({
  templates,
  preset,
  clients,
  defaultBrandColor,
}: Props) {
  // Hook must come before any conditional return.
  const [showBlankEditor, setShowBlankEditor] = React.useState(false);
  const [aiInitial, setAiInitial] = React.useState<{
    title: string;
    intro: string;
    sections: WelcomeDocumentSection[];
    clientId: string | null;
    brandColor: string | null;
    acknowledgementRequired: boolean;
  } | null>(null);

  const applyAiDraft = React.useCallback(
    (draft: AiWelcomeDraft) => {
      setAiInitial({
        title: draft.title,
        intro: draft.intro ?? "",
        sections: draft.sections.map((section, index) => ({
          id: `s_${index + 1}`,
          heading: section.heading,
          body: section.body,
        })),
        clientId: draft.clientId || null,
        brandColor: defaultBrandColor ?? "#2563EB",
        acknowledgementRequired: draft.acknowledgementRequired,
      });
      setShowBlankEditor(false);
    },
    [defaultBrandColor],
  );

  React.useEffect(() => {
    const stored = window.sessionStorage.getItem("stackivo.ai.welcomeDraft");
    if (!stored) return;
    try {
      const draft = JSON.parse(stored) as AiWelcomeDraft;
      applyAiDraft(draft);
      window.sessionStorage.removeItem("stackivo.ai.welcomeDraft");
    } catch {
      window.sessionStorage.removeItem("stackivo.ai.welcomeDraft");
    }
  }, [applyAiDraft]);

  if (aiInitial) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI welcome document"
          description="Review the draft, edit anything you need, then save it."
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAiInitial(null)}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Templates
            </Button>
          }
        />
        <WelcomeEditor mode="create" clients={clients} initial={aiInitial} />
      </div>
    );
  }

  if (preset) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={preset.title}
          description={
            preset.description ??
            "Customise the starting point — add, edit, or remove sections to match your business."
          }
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href={WELCOME_DOCUMENT_NEW}>
                <ArrowLeft className="h-3.5 w-3.5" /> Templates
              </Link>
            </Button>
          }
        />
        <WelcomeEditor
          mode="create"
          clients={clients}
          initial={{
            title: preset.title,
            intro: preset.intro ?? "",
            sections: preset.sections,
            clientId: null,
            brandColor: defaultBrandColor ?? "#2563EB",
            acknowledgementRequired: false,
          }}
        />
      </div>
    );
  }

  // Blank-start path — no template id in the URL.
  if (showBlankEditor) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Blank welcome document"
          description="Start from scratch — write the sections that fit your workflow."
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBlankEditor(false)}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Templates
            </Button>
          }
        />
        <WelcomeEditor
          mode="create"
          clients={clients}
          initial={{
            title: "",
            intro: "",
            sections: BLANK_SECTIONS,
            clientId: null,
            brandColor: defaultBrandColor ?? "#2563EB",
            acknowledgementRequired: false,
          }}
        />
      </div>
    );
  }

  // Always show code-owned built-ins first. Some older DB seed rows overlap
  // with these titles, so hide those stale duplicates and keep personal
  // templates separate below.
  const builtinTitles = new Set(BUILTIN_TEMPLATES.map((t) => t.title));
  const dbSystem = templates.filter(
    (t) =>
      t.isSystem &&
      t.title !== "Blank document" &&
      !builtinTitles.has(t.title),
  );
  const dbSystemIds = new Set(dbSystem.map((t) => t.id));
  const system = [
    ...BUILTIN_TEMPLATES.filter((t) => !dbSystemIds.has(t.id)),
    ...dbSystem,
  ];
  const personal = templates.filter((t) => !t.isSystem);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pick a starting point"
        description="Templates are fully editable — pick the closest fit and tweak as you go."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href={WELCOME_DOCUMENTS_INDEX}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
          </Button>
        }
      />

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Stackivo templates
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <BlankCard onSelect={() => setShowBlankEditor(true)} />
          {system.map((t) => (
            <TemplateCard key={t.id} tpl={t} />
          ))}
        </div>
      </div>

      {personal.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your saved templates
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {personal.map((t) => (
              <TemplateCard key={t.id} tpl={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BlankCard({ onSelect }: { onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex h-full flex-col rounded-lg border border-dashed bg-muted/20 p-4 text-left transition hover:border-primary hover:bg-muted/40"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-background text-muted-foreground">
        <FileText className="h-4 w-4" />
      </div>
      <div className="mt-3 flex-1">
        <p className="text-sm font-medium">Start blank</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Empty document with a single placeholder section.
        </p>
      </div>
    </button>
  );
}

function TemplateCard({ tpl }: { tpl: WelcomeDocumentTemplate }) {
  const Icon = tpl.isSystem ? BookOpen : Library;
  return (
    <Link
      href={`${WELCOME_DOCUMENT_NEW}?template=${tpl.id}`}
      className="group block h-full"
    >
      <Card className="h-full transition group-hover:border-primary group-hover:shadow-sm">
        <CardContent className="flex h-full flex-col p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="mt-3 flex-1">
            <p className="text-sm font-medium">{tpl.title}</p>
            {tpl.description && (
              <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                {tpl.description}
              </p>
            )}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {tpl.sections.length}{" "}
            {tpl.sections.length === 1 ? "section" : "sections"}
            {tpl.category ? ` · ${tpl.category}` : ""}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
