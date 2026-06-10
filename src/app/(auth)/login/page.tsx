import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Globe } from "lucide-react";
import {
  AuthFormFooterLink,
  AuthFormShell,
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

      {/* Client portal entry — clients land here too; route them clearly. */}
      <Link
        href="/portal-access"
        data-cta="login_portal_access"
        className="group mt-6 flex items-center gap-3 rounded-2xl border border-border/80 bg-muted/40 px-4 py-3.5 transition-colors hover:border-primary/25 hover:bg-primary/[0.04]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Globe className="h-4 w-4" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-foreground">
            Client of a Stackivo user?
          </span>
          <span className="block text-xs text-muted-foreground">
            Access your client portal here instead.
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </Link>
    </>
  );
}
