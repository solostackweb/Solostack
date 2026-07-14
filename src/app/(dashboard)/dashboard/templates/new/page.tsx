import { TemplateEditor } from "@/features/templates/components/template-editor";
import type { TemplateType } from "@/features/templates/builtin";

export const metadata = { title: "New template | Stackivo" };
export const dynamic = "force-dynamic";

const VALID_TYPES: TemplateType[] = [
  "proposal",
  "contract",
  "welcome_doc",
  "invoice_note",
  "email",
];

interface Props {
  searchParams: Promise<{ type?: string }>;
}

export default async function NewTemplatePage({ searchParams }: Props) {
  const sp = await searchParams;
  const type = (VALID_TYPES as string[]).includes(sp.type ?? "")
    ? (sp.type as TemplateType)
    : "proposal";

  return <TemplateEditor mode="create" templateType={type} />;
}
