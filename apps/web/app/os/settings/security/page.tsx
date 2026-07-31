"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Key, KeyRound, Shield, Smartphone } from "lucide-react";
import Link from "next/link";

import { Badge, Button } from "@fliptrybe/ui";
import { Input } from "@fliptrybe/ui/components";

import { loadSessions, loadTwoFactorStatus, type SessionRecord, type TwoFactorStatus } from "../../../security/api";

export default function SecuritySettingsPage() {
  const [twoFactor, setTwoFactor] = useState<TwoFactorStatus>();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadTwoFactorStatus(), loadSessions()])
      .then(([status, sessionList]) => {
        setTwoFactor(status);
        setSessions(sessionList);
      })
      .catch(() => {
        // Badges fall back to a neutral state below if this fails; the dedicated
        // sub-pages surface a real error state on load.
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="grid gap-8">
      {/* Password */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <Key className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Change Password</h2>
        </div>
        <div className="mt-6 grid gap-4 sm:max-w-sm">
          <Input disabled id="current-pw" label="Current password" type="password" />
          <Input disabled id="new-pw" label="New password" type="password" />
          <Input disabled id="confirm-pw" label="Confirm new password" type="password" />
          <div className="rounded-[var(--radius-md)] border border-[var(--ft-yellow)]/30 bg-[var(--ft-yellow-subtle)] p-3 text-xs leading-5 text-[var(--ft-text-secondary)]">
            Password change isn&apos;t wired to the backend yet — there&apos;s no endpoint for it.
          </div>
          <Button className="w-full justify-center sm:w-auto" disabled>Update password</Button>
        </div>
      </div>

      {/* 2FA & Devices links */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Account Security</h2>
        </div>

        <div className="mt-6 grid gap-3">
          <Link
            className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4 transition hover:border-[var(--ft-accent)]/30"
            href="/os/settings/security/two-factor"
          >
            <div className="flex items-center gap-3">
              <Smartphone className="size-5 text-[var(--ft-text-secondary)]" />
              <div>
                <div className="text-sm font-medium">Two-factor authentication</div>
                <div className="text-xs text-[var(--ft-text-muted)]">Add an extra layer of security</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={twoFactor?.enabled ? "success" : "warning"}>
                {loading ? "..." : twoFactor?.enabled ? "Enabled" : "Not enabled"}
              </Badge>
              <ArrowRight className="size-4 text-[var(--ft-text-muted)]" />
            </div>
          </Link>

          <Link
            className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4 transition hover:border-[var(--ft-accent)]/30"
            href="/os/settings/security/trusted-devices"
          >
            <div className="flex items-center gap-3">
              <KeyRound className="size-5 text-[var(--ft-text-secondary)]" />
              <div>
                <div className="text-sm font-medium">Active sessions</div>
                <div className="text-xs text-[var(--ft-text-muted)]">Manage devices signed into your account</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="info">{loading ? "..." : `${sessions.length} active`}</Badge>
              <ArrowRight className="size-4 text-[var(--ft-text-muted)]" />
            </div>
          </Link>
        </div>
      </div>

      {/* Recovery */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Recovery Settings</h2>
        </div>
        <div className="mt-6 grid gap-4 sm:max-w-sm">
          <Input disabled id="recovery-pin" label="Update recovery PIN" type="password" placeholder="4-6 digit PIN" />
          <div className="rounded-[var(--radius-md)] border border-[var(--ft-yellow)]/30 bg-[var(--ft-yellow-subtle)] p-3 text-xs leading-5 text-[var(--ft-text-secondary)]">
            Recovery PIN updates aren&apos;t wired to the backend yet.
          </div>
          <Button className="w-full justify-center sm:w-auto" disabled variant="secondary">Update recovery</Button>
        </div>
      </div>
    </div>
  );
}
