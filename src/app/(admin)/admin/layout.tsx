/**
 * Founder Console route group layout.
 *
 * Auth: middleware already rewrites non-admins to /404. We re-verify
 * here via `requireAdmin()` as defense-in-depth (belt + braces - if
 * middleware were ever misconfigured we still don't render).
 *
 * Provides the AdminShell chrome and resolves view-as state once per
 * navigation, passed through to the persistent banner.
 */

import { requireAdmin, getViewAsUserId } from "@/features/admin/server";
import { getUserOverview } from "@/features/admin/queries";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  // Resolve view-as target so the banner can render the user's name.
  const viewAsId = await getViewAsUserId();
  const viewingAs = viewAsId
    ? await getUserOverview(viewAsId).then((row) =>
        row ? { id: row.id, name: row.full_name, email: row.email } : null,
      )
    : null;

  return (
    <AdminShell adminEmail={admin.email ?? "admin"} viewingAs={viewingAs}>
      {children}
    </AdminShell>
  );
}
