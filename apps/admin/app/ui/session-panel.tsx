"use client";

import { ArrowRight, LogOut, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge, Button } from "@fliptrybe/ui";

import { useApiSession } from "../lib/use-session";

export function SessionPanel({ title = "Admin session" }: { title?: string }) {
  const { error, loading, refresh, session, signOut } = useApiSession();

  if (session) {
    return (
      <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4 text-sm shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium text-[var(--ft-text-primary)]">{title}</div>
          <Badge tone="success">Connected</Badge>
        </div>
        <div className="mt-4 grid gap-2 text-[var(--ft-text-secondary)]">
          <div className="truncate font-medium text-[var(--ft-text-primary)]">{session.workspace.name}</div>
          <div className="truncate">{session.user.name}</div>
          <div className="truncate text-xs text-[var(--ft-text-muted)]">@{session.user.username}</div>
          <div className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
            {session.role ?? "member"}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1 px-3" disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button className="flex-1 px-3" disabled={loading} onClick={() => void signOut()} variant="ghost">
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4 text-sm shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-[var(--ft-text-primary)]">{title}</div>
        <Badge tone={loading ? "info" : "warning"}>{loading ? "Checking" : "Signed out"}</Badge>
      </div>
      <div className="mt-4 flex gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-accent)]/35 bg-[var(--ft-accent-subtle)] text-[var(--ft-accent)]">
          <ShieldCheck className="size-5 stroke-[1.5]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm leading-5 text-[var(--ft-text-secondary)]">
            Sign in to open the admin desk with an automatically attached workspace session.
          </p>
          {error ? (
            <p className="mt-2 text-xs leading-5 text-[var(--ft-red)]">
              Admin session check is unavailable. Try again from the login screen.
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <a
          className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-accent)] bg-[var(--ft-accent)] px-3 text-sm font-semibold text-[var(--ft-bg-base)] transition hover:bg-[var(--ft-accent-dim)]"
          href="/login"
        >
          <span className="truncate">Sign in</span>
          <ArrowRight className="size-4" />
        </a>
        <Button className="px-3" disabled={loading} onClick={() => void refresh()} variant="secondary">
          <RefreshCw className="size-4" />
        </Button>
      </div>
    </div>
  );
}
