"use client";

import { Badge, Panel } from "@fliptrybe/ui";

type AdminAuthStateProps = {
  error?: string | undefined;
  loading: boolean;
  title?: string;
};

export function AdminAuthState({
  error,
  loading,
  title = "Admin auth"
}: AdminAuthStateProps) {
  return (
    <main className="ft-shell flex min-h-screen items-center justify-center px-4">
      <Panel className="w-full max-w-md p-6 text-center">
        <Badge tone={error ? "warning" : "info"}>{title}</Badge>
        <h1 className="mt-4 text-2xl font-semibold text-[var(--ft-text-primary)]">
          {loading ? "Loading admin session" : "Sign in required"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
          {loading
            ? "Checking the API session and workspace access."
            : error ?? "Redirecting to the admin sign-in page."}
        </p>
        {!loading ? (
          <a
            className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-[var(--ft-accent)] px-4 text-sm font-semibold text-[var(--ft-text-inverse)]"
            href="/login"
          >
            Open sign in
          </a>
        ) : null}
      </Panel>
    </main>
  );
}
