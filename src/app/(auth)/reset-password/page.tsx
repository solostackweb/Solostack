import {
  AuthFormError,
  AuthFormFooterLink,
  AuthFormShell,
} from "@/features/auth/components/auth-form-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata = { title: "Set a new password" };

export default async function ResetPasswordPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AuthFormShell
      title="Set a new password"
      description={
        user
          ? "Choose a strong password you haven't used elsewhere."
          : "Use the latest reset link from your email to continue."
      }
      footer={
        <AuthFormFooterLink
          prefix="Need a new reset link?"
          href="/forgot-password"
          label="Send again"
        />
      }
    >
      {user ? (
        <ResetPasswordForm />
      ) : (
        <AuthFormError message="This reset link is invalid or expired. Request a new password reset link and try again." />
      )}
    </AuthFormShell>
  );
}
