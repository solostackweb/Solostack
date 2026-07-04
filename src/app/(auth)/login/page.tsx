import { redirect } from "next/navigation";
import {
  AuthFormFooterLink,
  AuthFormShell,
  AuthModeSwitch,
} from "@/features/auth/components/auth-form-shell";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentUser } from "@/features/auth/server";
import {
  AUTH_DEFAULT_REDIRECT,
  isProtectedPath,
} from "@/features/auth/routes";

export const metadata = { title: "Log in" };

interface PageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  // Send authenticated users straight to their destination.
  const user = await getCurrentUser();
  if (user) {
    redirect(sp.next && sp.next.startsWith("/") ? sp.next : AUTH_DEFAULT_REDIRECT);
  }

  const next =
    sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//")
      ? sp.next
      : isProtectedPath(AUTH_DEFAULT_REDIRECT)
        ? AUTH_DEFAULT_REDIRECT
        : undefined;

  return (
    <>
      <AuthModeSwitch active="login" />
      <AuthFormShell
        title="Welcome back"
        description="Log in to your Stackivo workspace."
        footer={
          <AuthFormFooterLink
            prefix="Don't have an account?"
            href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
            label="Sign up"
          />
        }
      >
        <LoginForm next={next} oauthError={sp.error ?? null} />
      </AuthFormShell>
    </>
  );
}
