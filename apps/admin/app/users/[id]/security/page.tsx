"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, KeyRound, MonitorSmartphone, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminShell } from "../../../admin-shell";
import { apiRequest } from "../../../lib/api-client";
import { useApiSession } from "../../../lib/use-session";
import { AdminAuthState } from "../../../ui/admin-auth-state";

interface SecurityUser {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  status: string;
  isPlatformAdmin: boolean;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  totpEnabledAt: string | null;
  createdAt: string;
  activeSessionCount: number;
  sessions: Array<{
    id: string;
    deviceName: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    expiresAt: string;
    revokedAt: string | null;
    createdAt: string;
  }>;
  memberships: Array<{
    id: string;
    role: string;
    permissions: string[];
    organization: { id: string; name: string; slug: string };
  }>;
}

function when(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function sessionState(session: SecurityUser["sessions"][number]) {
  if (session.revokedAt) return "revoked";
  if (new Date(session.expiresAt).getTime() <= Date.now()) return "expired";
  return "active";
}

export default function AdminUserSecurityPage({ params }: { params: { id: string } }) {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [user, setUser] = useState<SecurityUser>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setUser(await apiRequest<SecurityUser>(`/admin/users/${encodeURIComponent(params.id)}/security`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load account security.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (session?.isPlatformAdmin) void refresh();
  }, [session, refresh]);

  async function revokeAll() {
    if (!user) return;
    const reason = window.prompt(`Revoke all active sessions for @${user.username}.\n\nReason recorded in the security audit trail:`);
    if (reason === null) return;
    if (reason.trim().length < 3) {
      setError("A reason of at least 3 characters is required.");
      return;
    }

    if (!window.confirm(`This will sign out every active session for @${user.username}. Continue?`)) return;

    setBusy(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const result = await apiRequest<{ revokedCount: number }>(`/admin/users/${encodeURIComponent(user.id)}/revoke-sessions`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() })
      });
      setSuccess(`${result.revokedCount} session(s) revoked.`);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not revoke sessions.");
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Security auth" />;
  }

  return (
    <AdminShell active="/users/" subtitle="Account security">
      <div className="mx-auto max-w-6xl">
        <Link className="inline-flex items-center gap-2 text-sm text-[var(--ft-text-secondary)] hover:text-[var(--ft-text-primary)]" href="/users/">
          <ArrowLeft className="size-4" /> Back to users
        </Link>

        {error ? <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-red)]/40 bg-[var(--ft-red)]/10 p-3 text-sm text-[var(--ft-red)]">{error}</p> : null}
        {success ? <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-green)]/40 bg-[var(--ft-green)]/10 p-3 text-sm text-[var(--ft-green)]">{success}</p> : null}

        {loading || !user ? (
          <Panel className="mt-5 p-6 text-sm text-[var(--ft-text-secondary)]">{loading ? "Loading account security..." : "User not found."}</Panel>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold">@{user.username}</h1>
                  <Badge tone={user.status === "ACTIVE" ? "success" : "danger"}>{user.status.toLowerCase()}</Badge>
                  {user.isPlatformAdmin ? <Badge tone="info">platform admin</Badge> : null}
                </div>
                <p className="mt-1 font-mono text-xs text-[var(--ft-text-muted)]">{user.id}</p>
              </div>
              <Button disabled={busy || user.isPlatformAdmin || user.activeSessionCount === 0} onClick={() => void revokeAll()} variant="secondary">
                <ShieldAlert className="size-4" />
                {busy ? "Revoking..." : `Revoke ${user.activeSessionCount} active session${user.activeSessionCount === 1 ? "" : "s"}`}
              </Button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <Panel className="p-4">
                <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-[var(--ft-green)]" /> Verification</div>
                <div className="mt-3 grid gap-2 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-[var(--ft-text-muted)]">Email</span><span>{when(user.emailVerifiedAt)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[var(--ft-text-muted)]">Phone</span><span>{when(user.phoneVerifiedAt)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[var(--ft-text-muted)]">2FA</span><span>{when(user.totpEnabledAt)}</span></div>
                </div>
              </Panel>
              <Panel className="p-4">
                <div className="flex items-center gap-2 font-semibold"><KeyRound className="size-4" /> Account</div>
                <div className="mt-3 grid gap-2 text-sm">
                  <div><span className="text-[var(--ft-text-muted)]">Email</span><div>{user.email ?? "—"}</div></div>
                  <div><span className="text-[var(--ft-text-muted)]">Phone</span><div>{user.phone ?? "—"}</div></div>
                  <div><span className="text-[var(--ft-text-muted)]">Created</span><div>{when(user.createdAt)}</div></div>
                </div>
              </Panel>
              <Panel className="p-4">
                <div className="flex items-center gap-2 font-semibold"><MonitorSmartphone className="size-4" /> Session posture</div>
                <div className="mt-3 text-3xl font-semibold">{user.activeSessionCount}</div>
                <div className="text-sm text-[var(--ft-text-secondary)]">active session(s)</div>
                <div className="mt-2 text-xs text-[var(--ft-text-muted)]">Showing the latest 25 sessions.</div>
              </Panel>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Panel className="overflow-hidden p-0">
                <div className="border-b border-[var(--ft-border)] p-4 font-semibold">Recent sessions</div>
                {user.sessions.map((item) => {
                  const state = sessionState(item);
                  return (
                    <div className="border-b border-[var(--ft-border)] p-4 last:border-b-0" key={item.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{item.deviceName ?? "Unknown device"}</div>
                          <div className="mt-1 text-xs text-[var(--ft-text-muted)]">{item.ipAddress ?? "No IP recorded"}</div>
                        </div>
                        <Badge tone={state === "active" ? "success" : state === "revoked" ? "danger" : "neutral"}>{state}</Badge>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-[var(--ft-text-secondary)] sm:grid-cols-2">
                        <div>Created: {when(item.createdAt)}</div>
                        <div>Expires: {when(item.expiresAt)}</div>
                        <div className="sm:col-span-2">{item.userAgent ?? "User agent unavailable"}</div>
                      </div>
                    </div>
                  );
                })}
              </Panel>

              <Panel className="p-4">
                <div className="font-semibold">Organization access</div>
                <div className="mt-3 grid gap-3">
                  {user.memberships.map((membership) => (
                    <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] p-3" key={membership.id}>
                      <div className="font-medium">{membership.organization.name}</div>
                      <div className="mt-1 text-xs text-[var(--ft-text-muted)]">{membership.organization.slug}</div>
                      <div className="mt-2"><Badge tone="info">{membership.role}</Badge></div>
                      <div className="mt-2 text-xs text-[var(--ft-text-secondary)]">
                        {membership.permissions.length ? membership.permissions.join(" · ") : "No explicit permissions"}
                      </div>
                    </div>
                  ))}
                  {user.memberships.length === 0 ? <div className="text-sm text-[var(--ft-text-secondary)]">No active organization memberships.</div> : null}
                </div>
              </Panel>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
