"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ArrowRight, LogIn, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge, Button, Panel, SummaryStatStrip } from "@fliptrybe/ui";

import { useApiSession } from "../lib/use-session";

export default function LoginPage() {
  const router = useRouter();
  const { error: sessionError, loading: sessionLoading, session, signIn } = useApiSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!sessionLoading && session) {
      router.replace("/campaign-ops");
    }
  }, [router, session, sessionLoading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);

    try {
      await signIn({ username, password });
      router.replace("/campaign-ops");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="ft-shell min-h-screen bg-[var(--ft-bg-base)] px-4 py-10 text-[var(--ft-text-primary)] sm:px-6 lg:px-8">
      <Panel className="mx-auto w-full max-w-xl overflow-hidden p-0">
        <div className="border-b border-[var(--ft-border)] bg-[var(--ft-bg-raised)] px-6 py-5 sm:px-8">
          <div className="flex items-center gap-2">
            <Badge tone="info">Admin auth</Badge>
            <span className="text-xs uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
              Username only
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal">Sign in</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">
            Use your internal FlipTrybe username and password. The admin workspace session
            attaches automatically.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {sessionLoading ? (
            <div className="mb-5 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm text-[var(--ft-text-secondary)]">
              Checking existing admin session...
            </div>
          ) : null}

          {sessionError ? (
            <div className="mb-5 rounded-md border border-[var(--ft-amber)]/40 bg-[var(--ft-amber-subtle)] p-3 text-sm text-[var(--ft-amber)]">
              {sessionError}
            </div>
          ) : null}

          <SummaryStatStrip
            items={[
              { label: "identity", value: "Username" },
              { label: "verification", value: "None" },
              { label: "workspace", value: "Auto-attached" }
            ]}
          />

          <form className="mt-6 grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
          <label className="grid gap-2 text-sm font-medium" htmlFor="username">
            Username
            <input
              autoComplete="username"
              className="h-11 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
              id="username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="admin"
              required
              type="text"
              value={username}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium" htmlFor="password">
            Password
            <input
              autoComplete="current-password"
              className="h-11 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="text-sm leading-6 text-[var(--ft-red)]">{error}</p> : null}

          <Button className="justify-center" disabled={submitting} type="submit">
            <LogIn className="size-4" />
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
          </form>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--ft-border)] pt-5 text-sm">
            <div className="flex items-center gap-2 text-[var(--ft-text-secondary)]">
              <ShieldCheck className="size-4 text-[var(--ft-accent)]" />
              Workspace session is attached automatically.
            </div>
            <a className="inline-flex items-center gap-2 font-medium text-[var(--ft-accent)]" href="/register">
              Create account
              <ArrowRight className="size-4" />
            </a>
          </div>
        </div>
      </Panel>
    </main>
  );
}
