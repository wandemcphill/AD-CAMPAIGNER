"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { useApiSession } from "../lib/use-session";

export default function RegisterPage() {
  const router = useRouter();
  const { loading: sessionLoading, session, signUp } = useApiSession();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!sessionLoading && session) {
      router.replace("/studio");
    }
  }, [router, session, sessionLoading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);

    try {
      const credentials = {
        username,
        password,
        confirmPassword,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {})
      };

      await signUp(credentials);
      router.replace("/studio");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ft-bg-base)] px-4 py-10 text-[var(--ft-text-primary)] sm:px-6 lg:px-8">
      <Panel className="mx-auto w-full max-w-lg p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <Badge tone="info">Internal auth</Badge>
          <span className="text-xs uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
            No email or OTP
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-normal">Create account</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
          Choose a username, add an optional display name, and we will create your workspace, membership, and
          session automatically.
        </p>

        <form className="mt-6 grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
          <label className="grid gap-2 text-sm font-medium" htmlFor="username">
            Username
            <input
              autoComplete="username"
              className="h-11 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
              id="username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="tunde"
              required
              type="text"
              value={username}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium" htmlFor="display-name">
            Display name
            <input
              autoComplete="name"
              className="h-11 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
              id="display-name"
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Tunde"
              type="text"
              value={displayName}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium" htmlFor="password">
            Password
            <input
              autoComplete="new-password"
              className="h-11 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium" htmlFor="confirm-password">
            Confirm password
            <input
              autoComplete="new-password"
              className="h-11 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
              id="confirm-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>

          {error ? <p className="text-sm leading-6 text-[var(--ft-red)]">{error}</p> : null}

          <Button className="justify-center" disabled={submitting} type="submit">
            <UserPlus className="size-4" />
            {submitting ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--ft-border)] pt-5 text-sm">
          <div className="flex items-center gap-2 text-[var(--ft-text-secondary)]">
            <ShieldCheck className="size-4 text-[var(--ft-accent)]" />
            Workspace and membership are created automatically.
          </div>
          <a className="inline-flex items-center gap-2 font-medium text-[var(--ft-accent)]" href="/login">
            Sign in
            <ArrowRight className="size-4" />
          </a>
        </div>
      </Panel>
    </main>
  );
}
