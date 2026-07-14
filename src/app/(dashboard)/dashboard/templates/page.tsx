import { TemplatesView } from "@/features/templates/components/templates-view";
import { listPersonalTemplates } from "@/features/templates/server";
import { BUILTIN_TEMPLATES } from "@/features/templates/builtin";

export const metadata = { title: "Templates | Stackivo" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await listPersonalTemplates();
  return <TemplatesView templates={templates} builtins={BUILTIN_TEMPLATES} />;
}
