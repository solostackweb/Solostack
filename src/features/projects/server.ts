import "server-only";

/**
 * Project persistence layer.
 *
 * RLS enforces tenant isolation — all reads/writes are scoped to the
 * authenticated user. View-models are camel-cased + decoupled from the
 * raw DB row shape so call sites don't break on schema evolution.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import type {
  ProjectRow,
  ProjectStatusRow,
  ProjectStatusHistoryRow,
} from "@/lib/supabase/types";

export interface ProjectStatusHistoryEntry {
  id: string;
  fromStatus: ProjectStatusRow | null;
  toStatus: ProjectStatusRow;
  note: string | null;
  createdAt: string;
}

/**
 * Returns the status timeline for a single project, newest first.
 * RLS bounds the result to the owner so no extra filter is needed here.
 */
export async function listProjectStatusHistory(
  projectId: string,
  limit = 50,
): Promise<ProjectStatusHistoryEntry[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("project_status_history")
    .select("id, from_status, to_status, note, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as unknown as ProjectStatusHistoryRow[]).map((row) => ({
    id: row.id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    note: row.note,
    createdAt: row.created_at,
  }));
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string | null;
  clientId: string | null;
  status: ProjectStatusRow;
  startDate: string | null;
  dueDate: string | null;
  billingEnabled: boolean;
  hourlyRate: number;
  createdAt: string;
  updatedAt: string;
}

export function mapProjectRow(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    clientId: row.client_id,
    status: row.status,
    startDate: row.start_date,
    dueDate: row.due_date,
    billingEnabled: row.billing_enabled,
    hourlyRate: row.hourly_rate,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ListProjectsOptions {
  status?: ProjectStatusRow | "all";
  clientId?: string;
  search?: string;
  limit?: number;
}

export async function listProjects(
  options: ListProjectsOptions = {},
): Promise<ProjectRecord[]> {
  const supabase = await getServerSupabase();
  let q = supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 200);

  if (options.status && options.status !== "all") q = q.eq("status", options.status);
  if (options.clientId) q = q.eq("client_id", options.clientId);
  if (options.search?.trim()) {
    const term = options.search.trim().replace(/[%,]/g, "");
    q = q.ilike("name", `%${term}%`);
  }

  const { data, error } = await q;
  if (error || !data) return [];
  return (data as unknown as ProjectRow[]).map(mapProjectRow);
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapProjectRow(data as unknown as ProjectRow);
}

/**
 * Counts + recents for the dashboard. Cheap because RLS bounds row counts
 * to the current user's data.
 */
export async function getProjectAggregates(): Promise<{
  total: number;
  active: number;
  completed: number;
  recent: ProjectRecord[];
}> {
  const supabase = await getServerSupabase();
  const [{ count: total }, { count: active }, { count: completed }, { data }] =
    await Promise.all([
      supabase.from("projects").select("id", { count: "exact", head: true }),
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
      supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  return {
    total: total ?? 0,
    active: active ?? 0,
    completed: completed ?? 0,
    recent: ((data as unknown as ProjectRow[]) ?? []).map(mapProjectRow),
  };
}
