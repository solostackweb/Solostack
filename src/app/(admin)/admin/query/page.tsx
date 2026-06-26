/**
 * /admin/query — SQL editor.
 *
 * Read-only escape hatch over the `admin_readonly` Postgres role.
 * Every run is audited to `admin_actions` with the query text (first
 * 2000 chars) in metadata. Statement timeout enforced at 30s by the
 * backing function.
 */

import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/kit";
import { SqlRunner } from "@/components/admin/sql-runner";
import { requireAdmin } from "@/features/admin/server";

export const dynamic = "force-dynamic";

export default async function AdminQueryPage() {
  await requireAdmin();

  return (
    <AdminSection>
      <AdminPageHeader
        title="SQL"
        subtitle="Read-only query against public schema · 30s timeout · audited"
      />
      <SqlRunner />
      <p className="text-[11px] text-muted-foreground">
        Built-in escape hatch for the questions the console UI hasn&apos;t
        modeled yet. Only <code>SELECT</code> / <code>WITH</code> /{" "}
        <code>EXPLAIN</code> are allowed. Schema reference:{" "}
        <code>information_schema.columns</code> works too.
      </p>
    </AdminSection>
  );
}
