import "server-only";

import { notFound } from "next/navigation";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import type { LeadFormRow, LeadSubmissionRow } from "@/lib/supabase/types";

export type LeadFormRecord = LeadFormRow;
export type LeadSubmissionRecord = LeadSubmissionRow & {
  form?: Pick<LeadFormRow, "id" | "name" | "slug" | "title"> | null;
};

export async function listLeadForms(): Promise<LeadFormRecord[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("lead_forms")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return data as LeadFormRecord[];
}

export async function listLeadSubmissions(): Promise<LeadSubmissionRecord[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("lead_submissions")
    .select("*, lead_forms(id,name,slug,title)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return (data as Array<LeadSubmissionRow & { lead_forms?: LeadSubmissionRecord["form"] }>).map(
    (row) => ({
      ...row,
      form: row.lead_forms ?? null,
    }),
  );
}

export async function getLeadForm(id: string): Promise<LeadFormRecord | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("lead_forms")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as LeadFormRecord;
}

export async function getPublicLeadForm(slug: string): Promise<LeadFormRecord> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("lead_forms")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) notFound();
  return data as LeadFormRecord;
}
