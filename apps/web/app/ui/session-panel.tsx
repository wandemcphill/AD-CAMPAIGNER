"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { LogIn, LogOut, RefreshCw, UserPlus } from "lucide-react";

import { Badge, Button, cn } from "@fliptrybe/ui";

import { getApiBaseUrl, type AuthCredentials } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";

export function SessionPanel({ title = "Workspace session" }: { title?: string }) {
  const { error, loading, refresh, session, signIn, signOut, signUp } = useApiSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submitSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(undefined);

    const credentials: AuthCredentials = { email, password };
    if (mode === "register" && name.trim()) {
      credentials.name = name.trim();
    }
    if (mode === "register" && workspaceName.trim()) {
      credentials.workspaceName = workspaceName.trim();
    }

    try {
      if (mode === "register") {
        await signUp(credentials);
      } else {
        await signIn(credentials);
      }
      setPassword("");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Session request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    void submitSession(event);
  }

  if (session) {
    return (
      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm lg:block">
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium text-zinc-950">{title}</div>
          <Badge tone="success">Connected</Badge>
        </div>
        <div className="mt-4 grid gap-2 text-zinc-600">
          <div className="truncate font-medium text-zinc-950">{session.workspace.name}</div>
          <div className="truncate">{session.user.email}</div>
          <div className="text-xs text-zinc-500">{session.role ?? "member"}</div>
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
    <form
      className="mt-6 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-zinc-950">{title}</div>
        <Badge tone={loading ? "info" : "warning"}>{loading ? "Checking" : "Signed out"}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-md bg-zinc-100 p-1">
        {[
          { value: "login", label: "Login", icon: LogIn },
          { value: "register", label: "Register", icon: UserPlus }
        ].map((item) => (
          <button
            className={cn(
              "flex h-9 items-center justify-center gap-2 rounded-md text-xs font-medium transition",
              mode === item.value ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500"
            )}
            key={item.value}
            onClick={() => setMode(item.value as "login" | "register")}
            type="button"
          >
            <item.icon className="size-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      {mode === "register" ? (
        <>
          <label className="grid gap-1 text-xs font-medium text-zinc-600">
            Name
            <input
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-600">
            Workspace
            <input
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950"
              onChange={(event) => setWorkspaceName(event.target.value)}
              value={workspaceName}
            />
          </label>
        </>
      ) : null}

      <label className="grid gap-1 text-xs font-medium text-zinc-600">
        Email
        <input
          className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-zinc-600">
        Password
        <input
          className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>

      {formError || error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs leading-5 text-red-700">
          {formError ?? error}
        </div>
      ) : null}

      <Button disabled={submitting || loading} type="submit">
        {mode === "register" ? <UserPlus className="size-4" /> : <LogIn className="size-4" />}
        {submitting ? "Working" : mode === "register" ? "Create session" : "Sign in"}
      </Button>
      <div className="break-all text-xs text-zinc-500">{getApiBaseUrl()}</div>
    </form>
  );
}
