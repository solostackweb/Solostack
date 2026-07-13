import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";
import type { DocumentTemplateRow } from "@/lib/supabase/types";
import { BUILTIN_TEMPLATES, type TemplateRecord, type TemplateType } from "./builtin";

function mapRow(row: DocumentTemplateRow): TemplateRecord {
  return {
    id: row.id,
    userId: row.user_id,
    templateType: row.template_type,
    title: row.title,
    description: row.description,
    category: row.category,
    content: row.content,
    active: row.active,
    isSystem: false,
    updatedAt: row.updated_at,
  };
}

export async function listTemplates(type?: TemplateType): Promise<TemplateRecord[]> {
  const supabase = await getServerSupabase();
  let query = supabase
    .from("document_templates")
    .select("*")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (type) query = query.eq("template_type", type);

  const { data } = await query;
  const personal = ((data as DocumentTemplateRow[] | null) ?? []).map(mapRow);
  const builtin = BUILTIN_TEMPLATES.filter((template) => !type || template.templateType === type);
  return [...builtin, ...personal];
}

export async function listPersonalTemplates(): Promise<TemplateRecord[]> {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("document_templates")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);
  return ((data as DocumentTemplateRow[] | null) ?? []).map(mapRow);
}
