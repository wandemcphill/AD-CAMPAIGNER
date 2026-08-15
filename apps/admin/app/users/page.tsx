"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, Users } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type UserStatus = "ACTIVE" | "SUSPENDED";

type UserRow = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  status: UserStatus;
  isPlatformAdmin: boolean;
  createdAt: string;
};

type UserDetail = UserRow & {
  displayName: string | null;
  phone: string | null;
  emailVerifiedAt: string | null;
  totpEnabledAt: string | null;
  deletedAt: string | null;
  memberships: Array<{ role: string; workspace: { id: string; name: string } }>;
};

function formatWhen(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(date);
}

export default function AdminUsersPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserDetail>();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  // Takes its filters as arguments so the callback identity stays stable —
  // otherwise the mount effect below would refire on every keystroke.
  const search = useCallback(async (term: string, status: UserStatus | "") => {
    setLoading(true);
    setError(undefined);
    try {
      const params = new URLSearchParams();
      if (term.trim()) params.set("q", term.trim());
      if (status) params.set("status", status);
      const result = await apiRequest<{ users: UserRow[] }>(
        `/admin/users${params.toString() ? `?${params.toString()}` : ""}`
      );
      setUsers(result.users);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not search users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && session?.isPlatformAdmin) {
      void search("", "");
    }
  }, [sessionLoading, session, search]);

  async function openUser(id: string) {
    setError(undefined);
    setSuccess(undefined);
    try {
      setSelected(await apiRequest<UserDetail>(`/admin/users/${encodeURIComponent(id)}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this user.");
    }
  }

  async function setStatus(user: UserDetail, status: UserStatus) {
    const verb = status === "SUSPENDED" ? "Suspend" : "Reactivate";
    const reason = window.prompt(
      `${verb} ${user.username}?\n\n` +
        (status === "SUSPENDED"
          ? "They will be signed out immediately and unable to log back in.\n\n"
          : "") +
        "Reason (recorded in the audit log):"
    );

    if (reason === null) return;
    if (reason.trim().length < 3) {
      setError("A reason of at least 3 characters is required.");
      return;
    }

    setBusy(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      await apiRequest(`/admin/users/${encodeURIComponent(user.id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason: reason.trim() })
      });
      setSuccess(`${user.username} is now ${status.toLowerCase()}.`);
      await openUser(user.id);
      await search(query, statusFilter);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not ${verb.toLowerCase()} this user.`);
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Users auth" />;
  }

  return (
    <AdminShell active="/users/">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-[var(--ft-accent)]" />
          <h1 className="text-xl font-bold">Users</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
          Search accounts, review workspace memberships, and suspend or reactivate access.
        </p>

        <Panel className="mt-5 flex flex-wrap gap-2 p-4">
          <input
            className="min-w-64 flex-1 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-3 py-2 text-sm"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void search(query, statusFilter);
            }}
            placeholder="Username, name, email, or user ID"
            value={query}
          />
          <select
            className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-3 py-2 text-sm"
            onChange={(event) => setStatusFilter(event.target.value as UserStatus | "")}
            value={statusFilter}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <Button disabled={loading} onClick={() => void search(query, statusFilter)}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </Panel>

        {error ? (
          <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-red)]/40 bg-[var(--ft-red)]/10 p-3 text-sm text-[var(--ft-red)]">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-green)]/40 bg-[var(--ft-green)]/10 p-3 text-sm text-[var(--ft-green)]">
            {success}
          </p>
        ) : null}

        <Panel className="mt-4 overflow-hidden p-0">
          {users.length === 0 ? (
            <p className="p-4 text-sm text-[var(--ft-text-secondary)]">
              {loading ? "Searching..." : "No users matched."}
            </p>
          ) : (
            users.map((user) => (
              <button
                className="grid w-full gap-2 border-b border-[var(--ft-border)] p-3 text-left transition last:border-b-0 hover:bg-[var(--ft-bg-muted)] md:grid-cols-[1fr_180px_120px_110px] md:items-center"
                key={user.id}
                onClick={() => void openUser(user.id)}
                type="button"
              >
                <div>
                  <div className="font-medium">{user.name}</div>
                  <div className="font-mono text-xs text-[var(--ft-text-muted)]">
                    @{user.username}
                  </div>
                </div>
                <div className="truncate text-sm text-[var(--ft-text-secondary)]">
                  {user.email ?? "—"}
                </div>
                <Badge tone={user.status === "ACTIVE" ? "success" : "danger"}>
                  {user.status.toLowerCase()}
                </Badge>
                <div className="text-xs text-[var(--ft-text-muted)]">
                  {user.isPlatformAdmin ? "platform admin" : formatWhen(user.createdAt)}
                </div>
              </button>
            ))
          )}
        </Panel>

        {selected ? (
          <Panel className="mt-4 grid gap-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{selected.name}</div>
                <div className="font-mono text-xs text-[var(--ft-text-muted)]">
                  @{selected.username} · {selected.id}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {selected.isPlatformAdmin ? <Badge tone="info">platform admin</Badge> : null}
                <Badge tone={selected.status === "ACTIVE" ? "success" : "danger"}>
                  {selected.status.toLowerCase()}
                </Badge>
              </div>
            </div>

            <div className="grid gap-1 text-sm text-[var(--ft-text-secondary)] md:grid-cols-2">
              <div>Email: {selected.email ?? "—"}</div>
              <div>Phone: {selected.phone ?? "—"}</div>
              <div>Email verified: {formatWhen(selected.emailVerifiedAt)}</div>
              <div>2FA enabled: {formatWhen(selected.totpEnabledAt)}</div>
              <div>Joined: {formatWhen(selected.createdAt)}</div>
            </div>

            <div>
              <div className="text-sm font-medium">Workspaces</div>
              {selected.memberships.length === 0 ? (
                <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">No memberships.</p>
              ) : (
                <div className="mt-1 grid gap-1">
                  {selected.memberships.map((membership) => (
                    <div
                      className="flex items-center justify-between gap-3 border-t border-[var(--ft-border)] pt-1 text-sm"
                      key={membership.workspace.id}
                    >
                      <span>{membership.workspace.name}</span>
                      <span className="font-mono text-xs text-[var(--ft-text-muted)]">
                        {membership.role} · {membership.workspace.id}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {selected.status === "ACTIVE" ? (
                <Button
                  disabled={busy || selected.isPlatformAdmin}
                  onClick={() => void setStatus(selected, "SUSPENDED")}
                  variant="secondary"
                >
                  <ShieldAlert className="size-4" />
                  Suspend
                </Button>
              ) : (
                <Button disabled={busy} onClick={() => void setStatus(selected, "ACTIVE")}>
                  <ShieldCheck className="size-4" />
                  Reactivate
                </Button>
              )}
            </div>

            {selected.isPlatformAdmin && selected.status === "ACTIVE" ? (
              <p className="text-xs text-[var(--ft-text-muted)]">
                Platform admins cannot be suspended here. Remove the account from
                PLATFORM_ADMIN_USERNAMES first, otherwise it could not be restored from inside the
                product.
              </p>
            ) : null}
          </Panel>
        ) : null}
      </div>
    </AdminShell>
  );
}
