import {
  AuthFormShell,
  AuthModeSwitch,
} from "@/features/auth/components/auth-form-shell";
import { PortalAccessForm } from "@/features/auth/components/portal-access-form";

export const metadata = { title: "Client portal access" };

/**
 * /portal-access — a clean, dedicated page for clients to enter their portal
 * via a one-time email code. Completely separate from the freelancer login flow
 * so neither user group is confused by the other's interface. The mode
 * switch above the card already covers "wrong tab, I'm a freelancer" — no
 * need to repeat that in the footer too.
 */
export default function PortalAccessPage() {
  return (
    <>
      <AuthModeSwitch active="portal" />
      <AuthFormShell
        title="Access your client portal"
        description="Enter your email and we'll send you a one-time code to open your workspace."
      >
        <PortalAccessForm />
      </AuthFormShell>
    </>
  );
}
