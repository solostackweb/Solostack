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

export interface LeadSubmissionPage {
  items: LeadSubmissionRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export async function countLeadSubmissions(): Promise<number> {
  const supabase = await getServerSupabase();
  const { count } = await supabase
    .from("lead_submissions")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function listLeadSubmissions(options: {
  page?: number;
  pageSize?: number;
  search?: string;
} = {}): Promise<LeadSubmissionPage> {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(100, Math.max(10, Math.floor(options.pageSize ?? 25)));
  const search = (options.search ?? "")
    .replace(/[^\p{L}\p{N}@._+\-\s]/gu, "")
    .trim()
    .slice(0, 100);
  const supabase = await getServerSupabase();
  let query = supabase
    .from("lead_submissions")
    .select("*, lead_forms(id,name,slug,title)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`,
    );
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);

  if (error || !data) return { items: [], total: 0, page, pageSize };
  return {
    items: (data as Array<LeadSubmissionRow & { lead_forms?: LeadSubmissionRecord["form"] }>).map(
      (row) => ({ ...row, form: row.lead_forms ?? null }),
    ),
    total: count ?? 0,
    page,
    pageSize,
  };
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
