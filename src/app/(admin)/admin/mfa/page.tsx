/**
 * /admin/mfa - enrollment + step-up.
 *
 * Reachable even before AAL2 is satisfied; `requireAdmin()` short-
 * circuits its MFA check on this path so an admin who hasn't enrolled
 * yet can complete enrollment without an infinite redirect loop.
 *
 * Note: this page calls `requireAdmin()` only to enforce the role -
 * the MFA-bypass logic for this exact path lives inside the helper.
 */

import { requireAdmin } from "@/features/admin/server";
import { getMfaStatus } from "@/features/admin/mfa";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/kit";
import { MfaEnrollFlow } from "@/components/admin/mfa-enroll";

export const dynamic = "force-dynamic";

export default async function AdminMfaPage() {
  await requireAdmin();
  const status = await getMfaStatus();

  return (
    <AdminSection>
      <AdminPageHeader
        title="Multi-factor authentication"
        subtitle="Required for production admin access - TOTP only in Phase 4"
      />
      <MfaEnrollFlow status={status} />
    </AdminSection>
  );
}
