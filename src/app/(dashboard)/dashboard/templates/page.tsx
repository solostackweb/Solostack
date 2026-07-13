import { TemplatesView } from "@/features/templates/components/templates-view";
import { listPersonalTemplates } from "@/features/templates/server";

export const metadata = { title: "Templates | Stackivo" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await listPersonalTemplates();
  return <TemplatesView templates={templates} />;
}
