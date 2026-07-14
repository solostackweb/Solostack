import { notFound } from "next/navigation";

import { TemplateEditor } from "@/features/templates/components/template-editor";
import { getPersonalTemplate } from "@/features/templates/server";

export const metadata = { title: "Edit template | Stackivo" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditTemplatePage({ params }: Props) {
  const { id } = await params;
  const template = await getPersonalTemplate(id);
  if (!template) notFound();

  return (
    <TemplateEditor
      mode="edit"
      templateType={template.templateType}
      template={template}
    />
  );
}
