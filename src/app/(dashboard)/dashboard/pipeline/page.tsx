import { PipelineBoard, type PipelineProjectValue } from "@/features/pipeline/components/pipeline-board";
import { listProjects } from "@/features/projects/server";
import { listClients } from "@/features/clients/server";
import { getClientDisplayName } from "@/features/clients/utils";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

type InvoiceValueRow = {
  project_id: string | null;
  total_amount: number | string | null;
  currency: string | null;
  status: string | null;
};

export default async function PipelinePage() {
  const [projects, clients, values] = await Promise.all([
    listProjects({ limit: 300 }),
    listClients({ limit: 300 }),
    getPipelineValues(),
  ]);

  return (
    <PipelineBoard
      projects={projects}
      clients={clients.map((client) => ({
        id: client.id,
        name: getClientDisplayName(client),
        country: client.country,
        currency: client.currency,
        isForeign: client.isForeign,
      }))}
      values={values}
    />
  );
}

async function getPipelineValues(): Promise<PipelineProjectValue[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("invoices")
    .select("project_id,total_amount,currency,status")
    .not("project_id", "is", null)
    .neq("status", "cancelled");

  if (error || !data) return [];

  const grouped = new Map<string, PipelineProjectValue>();
  for (const row of data as unknown as InvoiceValueRow[]) {
    if (!row.project_id) continue;
    const currency = (row.currency || "INR").toUpperCase();
    const amount = Number(row.total_amount ?? 0);
    const existing = grouped.get(row.project_id);
    if (!existing) {
      grouped.set(row.project_id, {
        projectId: row.project_id,
        amount,
        currency,
        invoiceCount: 1,
        openAmount: row.status === "paid" ? 0 : amount,
      });
      continue;
    }
    existing.amount += amount;
    existing.invoiceCount += 1;
    existing.openAmount += row.status === "paid" ? 0 : amount;
    if (existing.currency !== currency) existing.currency = "INR";
  }

  return Array.from(grouped.values());
}
